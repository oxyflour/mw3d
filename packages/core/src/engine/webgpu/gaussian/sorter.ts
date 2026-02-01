import Camera from '../../camera'
import Mesh from '../../mesh'
import Geometry, { GaussianSplatGeometry } from '../../geometry'
import Cache, { BindingResource } from '../cache'
// @ts-ignore
import sortWgsl from './sort.wgsl?raw'

type GaussianIndexCache = {
    buffer: GPUBuffer
    size: number
    count: number
}

export default class GaussianSorter {
    private readonly binCount = 4096
    private pipeline?: {
        clear: GPUComputePipeline
        count: GPUComputePipeline
        prefix: GPUComputePipeline
        scatter: GPUComputePipeline
    }
    private bindGroupLayout?: GPUBindGroupLayout
    private pipelineLayout?: GPUPipelineLayout
    private module?: GPUShaderModule
    private bins?: {
        counts: GPUBuffer
        offsets: GPUBuffer
        binCount: number
    }
    private geoCache = new WeakMap<GaussianSplatGeometry, {
        positions: GPUBuffer
        count: number
    }>()
    private indexCache = new WeakMap<Mesh, GaussianIndexCache>()

    constructor(private readonly device: GPUDevice, private readonly cache: Cache) {
    }

    hasGaussian(meshes: (Mesh & { geo: Geometry })[]) {
        return meshes.some(mesh => mesh.geo.type === 'gaussian-splat')
    }

    prepare(meshes: (Mesh & { geo: Geometry })[], camera: Camera, cmd: GPUCommandEncoder) {
        for (const mesh of meshes) {
            if (mesh.geo.type === 'gaussian-splat') {
                this.updateIndex(mesh, mesh.geo as GaussianSplatGeometry, camera, cmd)
            }
        }
    }

    indexFor(mesh: Mesh) {
        return this.indexCache.get(mesh)
    }

    private updateUniforms(bindings: BindingResource[]) {
        for (const binding of bindings) {
            const { uniforms } = binding,
                { buffer, offset = -1 } = binding as GPUBufferBinding
            if (buffer && offset >= 0) {
                const start = offset
                for (const { value, offset } of uniforms || []) {
                    if (!Array.isArray(value)) {
                        this.device.queue.writeBuffer(
                            buffer,
                            start + offset,
                            value.buffer,
                            value.byteOffset,
                            value.byteLength,
                        )
                    }
                }
            }
        }
    }

    private ensurePipeline() {
        if (this.pipeline) {
            return
        }
        const module = this.module || (this.module = this.device.createShaderModule({ code: sortWgsl + '' }))
        const bindGroupLayout = this.bindGroupLayout || (this.bindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ]
        }))
        const pipelineLayout = this.pipelineLayout || (this.pipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        }))
        this.pipeline = {
            clear: this.device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint: 'clearBins' } }),
            count: this.device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint: 'countBins' } }),
            prefix: this.device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint: 'prefixBins' } }),
            scatter: this.device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint: 'scatterIndices' } }),
        }
    }

    private ensureBins() {
        const binCount = this.binCount
        if (this.bins && this.bins.binCount === binCount) {
            return this.bins
        }
        const size = binCount * 4
        this.bins = {
            binCount,
            counts: this.device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
            offsets: this.device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
        }
        return this.bins
    }

    private ensurePositions(geo: GaussianSplatGeometry) {
        const cached = this.geoCache.get(geo)
        if (cached && cached.count === geo.pointCount) {
            return cached
        }
        const count = geo.pointCount
        const data = new Float32Array(count * 4)
        const src = geo.pointPositions
        for (let i = 0; i < count; i++) {
            const s = i * 3
            const d = i * 4
            data[d] = src[s] || 0
            data[d + 1] = src[s + 1] || 0
            data[d + 2] = src[s + 2] || 0
            data[d + 3] = 1
        }
        const buffer = this.device.createBuffer({
            size: data.byteLength,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        })
        new Float32Array(buffer.getMappedRange()).set(data)
        buffer.unmap()
        const entry = { positions: buffer, count }
        this.geoCache.set(geo, entry)
        return entry
    }

    private updateIndex(mesh: Mesh, geo: GaussianSplatGeometry, camera: Camera, cmd: GPUCommandEncoder) {
        const count = geo.pointCount
        if (!Number.isFinite(count) || count <= 0) {
            return
        }
        const indexCount = count * 6
        const byteSize = indexCount * 4
        let cache = this.indexCache.get(mesh)
        if (!cache || cache.size !== byteSize) {
            const buffer = this.device.createBuffer({
                size: byteSize,
                usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
            })
            cache = { buffer, size: byteSize, count: indexCount }
            this.indexCache.set(mesh, cache)
        }
        cache.count = indexCount

        this.ensurePipeline()
        const bins = this.ensureBins()
        const pos = this.ensurePositions(geo)
        const params = new Uint32Array([count, bins.binCount, 0, 0])
        const uniform = this.cache.array([mesh.worldMatrix, camera.viewProjection, params]) as BindingResource & { buffer: GPUBuffer, offset: number, size: number }
        this.updateUniforms([uniform])

        const bindGroup = this.device.createBindGroup({
            layout: this.bindGroupLayout!,
            entries: [
                { binding: 0, resource: { buffer: pos.positions } },
                { binding: 1, resource: { buffer: bins.counts } },
                { binding: 2, resource: { buffer: bins.offsets } },
                { binding: 3, resource: { buffer: cache.buffer } },
                { binding: 4, resource: { buffer: uniform.buffer, offset: uniform.offset, size: uniform.size } },
            ]
        })

        const pass = cmd.beginComputePass()
        const wg = 256
        const dispatchBins = Math.ceil(bins.binCount / wg)
        const dispatchPoints = Math.ceil(count / wg)
        pass.setBindGroup(0, bindGroup)
        pass.setPipeline(this.pipeline!.clear)
        pass.dispatchWorkgroups(dispatchBins)
        pass.setPipeline(this.pipeline!.count)
        pass.dispatchWorkgroups(dispatchPoints)
        pass.setPipeline(this.pipeline!.prefix)
        pass.dispatchWorkgroups(1)
        pass.setPipeline(this.pipeline!.scatter)
        pass.dispatchWorkgroups(dispatchPoints)
        pass.end()
    }
}
