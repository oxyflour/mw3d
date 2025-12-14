import cache from "../../utils/cache"
import { BasicMaterial, Camera, Material, Mesh, PerspectiveCamera, Scene, SpriteGeometry, Texture, Uniform, WebGPURenderer } from ".."
import { RenderMesh, RenderOptions } from "../renderer"

import wgsl from './tracer.wgsl?raw'
import { mat4, vec4 } from "gl-matrix"

function buildMesh(sorted: RenderMesh[]) {
    const verts = [] as number[],
        faces = [] as number[],
        triangles = [] as {
            min: [number, number, number]
            max: [number, number, number]
            centroid: [number, number, number]
            face: number
        }[],
        materials = [] as number[][],
        worldPos = vec4.create()
    for (const mesh of sorted) {
        if (mesh.geo.indices) {
            const m = materials.length
            materials.push(Array.from(mesh.mat.prop.data))
            const worldMatrix = mat4.clone(mesh.worldMatrix)
            const base = verts.length / 4
            for (let i = 0; i < mesh.geo.positions.length; i += 3) {
                vec4.set(worldPos,
                    mesh.geo.positions[i]!, mesh.geo.positions[i + 1]!, mesh.geo.positions[i + 2]!, 1)
                vec4.transformMat4(worldPos, worldPos, worldMatrix)
                verts.push(worldPos[0]!, worldPos[1]!, worldPos[2]!, 1)
            }
            // Fxxk: https://sotrh.github.io/learn-wgpu/showcase/alignment/#alignment-of-vertex-and-index-buffers
            for (let i = 0; i < mesh.geo.indices.length; i += 3) {
                const faceIndex = faces.length / 4,
                    a = base + mesh.geo.indices[i]!,
                    b = base + mesh.geo.indices[i + 1]!,
                    c = base + mesh.geo.indices[i + 2]!,
                    min = [
                        Math.min(verts[a * 4]!, verts[b * 4]!, verts[c * 4]!),
                        Math.min(verts[a * 4 + 1]!, verts[b * 4 + 1]!, verts[c * 4 + 1]!),
                        Math.min(verts[a * 4 + 2]!, verts[b * 4 + 2]!, verts[c * 4 + 2]!),
                    ] as [number, number, number],
                    max = [
                        Math.max(verts[a * 4]!, verts[b * 4]!, verts[c * 4]!),
                        Math.max(verts[a * 4 + 1]!, verts[b * 4 + 1]!, verts[c * 4 + 1]!),
                        Math.max(verts[a * 4 + 2]!, verts[b * 4 + 2]!, verts[c * 4 + 2]!),
                    ] as [number, number, number]
                faces.push(a, b, c, m)
                triangles.push({
                    min,
                    max,
                    centroid: [
                        (min[0]! + max[0]!) / 2,
                        (min[1]! + max[1]!) / 2,
                        (min[2]! + max[2]!) / 2,
                    ],
                    face: faceIndex,
                })
            }
        }
    }
    return { verts, faces, materials, triangles }
}

function buildBVH(triangles: {
    min: [number, number, number]
    max: [number, number, number]
    centroid: [number, number, number]
    face: number
}[]) {
    type Node = {
        min: [number, number, number]
        max: [number, number, number]
        left: number
        right: number
        start: number
        count: number
    }
    const nodes: Node[] = [],
        work = triangles.slice()
    const build = (start: number, end: number): number => {
        const node: Node = {
            min: [Infinity, Infinity, Infinity],
            max: [-Infinity, -Infinity, -Infinity],
            left: -1,
            right: -1,
            start,
            count: end - start,
        }
        for (let i = start; i < end; i ++) {
            const tri = work[i]!,
                { min, max } = tri
            for (let j = 0; j < 3; j ++) {
                node.min[j] = Math.min(node.min[j]!, min[j]!)
                node.max[j] = Math.max(node.max[j]!, max[j]!)
            }
        }

        const idx = nodes.push(node) - 1
        if (node.count <= 4) {
            return idx
        }

        const min = [Infinity, Infinity, Infinity] as [number, number, number],
            max = [-Infinity, -Infinity, -Infinity] as [number, number, number]
        for (let i = start; i < end; i ++) {
            const { centroid } = work[i]!
            for (let j = 0; j < 3; j ++) {
                min[j] = Math.min(min[j]!, centroid[j]!)
                max[j] = Math.max(max[j]!, centroid[j]!)
            }
        }
        const extent = [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as [number, number, number],
            axis = extent[1] > extent[0] ? (extent[1] > extent[2] ? 1 : 2) : (extent[0] > extent[2] ? 0 : 2),
            sorted = work.slice(start, end).sort((a, b) => a.centroid[axis]! - b.centroid[axis]!)
        for (let i = 0; i < sorted.length; i ++) {
            work[start + i] = sorted[i]!
        }
        const mid = start + (node.count >> 1)
        node.left = build(start, mid)
        node.right = build(mid, end)
        node.count = 0
        node.start = 0
        return idx
    }
    if (work.length) {
        build(0, work.length)
    }
    const stride = 12,
        buffer = new ArrayBuffer(nodes.length * stride * 4),
        f32 = new Float32Array(buffer),
        u32 = new Uint32Array(buffer)
    nodes.forEach((node, idx) => {
        const offset = idx * stride
        f32.set([...node.min, 0, ...node.max, 0], offset)
        u32[offset + 8] = node.left >= 0 ? node.left : 0xffffffff
        u32[offset + 9] = node.right >= 0 ? node.right : 0xffffffff
        u32[offset + 10] = node.start
        u32[offset + 11] = node.count
    })
    const order = new Uint32Array(work.length)
    for (let i = 0; i < work.length; i ++) {
        order[i] = work[i]!.face
    }
    return { nodes: u32, order }
}

export default class WebGPUTracer extends WebGPURenderer {
    private pipeline!: GPUComputePipeline
    protected override async init() {
        const { device } = await super.init()
        this.pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({ code: wgsl }),
                entryPoint: 'main'
            }
        })
        return this
    }
    private cameraPropUniform = new Float32Array([1, 1, 1, 0])
    private binding = cache((tex: GPUTexture) => {
        const texture = new Texture({
            size: { width: tex.width, height: tex.height },
            format: 'rgba8unorm',
            usage: Texture.Usage.TEXTURE_BINDING | Texture.Usage.COPY_DST | Texture.Usage.STORAGE_BINDING,
        })
        const output = {
            uniforms: [
                texture,
                [this.cameraPropUniform]
            ],
            bindingGroup: 0,
        }
        this.fullScreenQuad.mat = new BasicMaterial({ texture })
        return output
    })
    private meshesObject = {
        uniforms: [] as Uniform[],
        bindingGroup: 2,
    }
    private fullScreenQuad = new Mesh(new SpriteGeometry({ positions: [0, 0, 0], width: 2, height: 2 }))
    private renderSetup = {
        scene: new Scene([this.fullScreenQuad]),
        camera: new Camera()
    }
    override render(scene: Scene, camera: Camera, opts = { } as RenderOptions & {
        webgpu?: {
            disableBundle?: boolean
            depthStencilAttachment?: Partial<GPURenderPassDepthStencilAttachment>
            commandEncoder?: GPUCommandEncoder
        }
    }) {
        const { sorted, updated } = this.prepare(scene, camera, { disableTransparent: true })
        const needsMeshUpdate = this.cachedRenderPass.compare(sorted) ||
            Array.from(updated).some(item => item instanceof Mesh || item instanceof Material)
        if (needsMeshUpdate) {
            this.cachedRenderPass.objs = sorted.map(mesh => ({ mesh, geo: mesh.geo, mat: mesh.mat, offset: mesh.offset, count: mesh.count }))
            const { verts, faces, materials, triangles } = buildMesh(sorted),
                { nodes, order } = buildBVH(triangles)
            this.meshesObject.uniforms = [
                [new Float32Array(verts)],
                [new Uint32Array(faces)],
                [new Float32Array(materials.flat())],
                [nodes],
                [order],
            ].map(item => Object.assign(item, {
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            }))
            this.updateUniforms(this.cache.bindings(this.meshesObject))
        }

        this.cameraPropUniform[2] = this.opts.sampleCount || 1
        if (camera instanceof PerspectiveCamera) {
            const hf = Math.tan(camera.fov / 2)
            this.cameraPropUniform[0] =  hf * camera.aspect
            this.cameraPropUniform[1] = -hf
        }

        const cmd = this.device.createCommandEncoder(),
            pass = cmd.beginComputePass(),
            { pipeline, cache } = this,
            { width, height } = cache.fragmentTexture,
            output = this.binding(cache.fragmentTexture)
        pass.setPipeline(pipeline)
        pass.setBindGroup(...cache.bind(pipeline, output))
        pass.setBindGroup(...cache.bind(pipeline, camera))
        pass.setBindGroup(...cache.bind(pipeline, this.meshesObject))
        this.updateUniforms(cache.bindings(output))
        this.updateUniforms(cache.bindings(camera))
        pass.dispatchWorkgroups(width, height)
        pass.end()
        if (opts.webgpu?.commandEncoder) {
            throw Error(`should not use opts.webgpu.commandEncoder with tracer`)
        } else {
            const { scene, camera } = this.renderSetup,
                webgpu = opts.webgpu || (opts.webgpu = { })
            webgpu.commandEncoder = cmd
            webgpu.disableBundle = true
            super.render(scene, camera, opts)
        }
    }
}
