import cache from "../../utils/cache"
import Geometry, { GeometryPrimitive } from "../geometry"
import Material from "../material"
import { Sampler, Texture, Uniform, UniformValue } from '../uniform'
import wgsl from './shader.wgsl?raw'

// Note: wgsl global const not yet supported
const WGSL_CODE = (wgsl + '').replace(/\r\n/g, '\n').replace(/\/\/ @replace-let-with-const\nlet /g, 'const ')

export interface CachedAttr {
    buffer: GPUBuffer
}

export type BindingResource = GPUBindingResource & {
    uniforms?: { value: UniformValue, offset: number }[]
}

export interface CachedBind {
    pipeline: GPURenderPipeline
    index: number
    buffers: GPUBuffer[]
    group: GPUBindGroup
}

export type CachedPipeline = {
    pipeline: GPURenderPipeline
    id: number
}

export default class Cache {
    private cachedFragmentTexture: GPUTexture
    get fragmentTexture() {
        return this.cachedFragmentTexture
    }
    private cachedDepthTexture: GPUTexture
    get depthTexture() {
        return this.cachedDepthTexture
    }
    constructor(readonly device: GPUDevice, readonly opts: {
        size: { width: number, height: number }
        fragmentFormat: GPUTextureFormat
        depthFormat: GPUTextureFormat
        uniformBufferBatchSize?: number
        multisample?: GPUMultisampleState
    }) {
        this.cachedFragmentTexture = this.device.createTexture({
            size: opts.size,
            format: this.opts.fragmentFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            sampleCount: this.opts.multisample?.count,
        })
        this.cachedDepthTexture = this.device.createTexture({
            size: opts.size,
            format: this.opts.depthFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            sampleCount: this.opts.multisample?.count,
        })
    }
    resize(size: { width: number, height: number }) {
        this.cachedFragmentTexture.destroy(),
        this.cachedFragmentTexture = this.device.createTexture({
            size: size,
            format: this.opts.fragmentFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
            sampleCount: this.opts.multisample?.count,
        })
        this.cachedDepthTexture.destroy()
        this.cachedDepthTexture = this.device.createTexture({
            size,
            format: this.opts.depthFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            sampleCount: this.opts.multisample?.count,
        })
    }
    texture = cache((tex: Texture) => {
        const texture = this.device.createTexture(tex.opts),
            { source, size } = tex.opts
        if (source) {
            this.device.queue.copyExternalImageToTexture({ source }, { texture }, size)
        }
        return texture
    })
    sampler = cache((sampler: Sampler) => {
        return this.device.createSampler(sampler.opts)
    })
    idx = cache((val: Uint32Array | Uint16Array) => {
        const buffer = this.device.createBuffer({
            size: val.length * (val instanceof Uint32Array ? 4 : 2),
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true
        })
        const map = buffer.getMappedRange(),
            arr = val instanceof Uint32Array ? new Uint32Array(map) : new Uint16Array(map),
            type = val instanceof Uint32Array ? 'uint32' : 'uint16'
        arr.set(val)
        buffer.unmap()
        return [buffer, type] as [GPUBuffer, 'uint32' | 'uint16']
    })
    attrs = cache((geo: Geometry) => {
        const list = [] as CachedAttr[]
        for (const array of geo.attributes) {
            const buffer = this.device.createBuffer({
                size: array.byteLength,
                usage: GPUBufferUsage.VERTEX,
                mappedAtCreation: true
            })
            new Float32Array(buffer.getMappedRange()).set(array)
            buffer.unmap()
            list.push({ buffer })
        }
        return list
    })

    private cachedUniformBuffer = { buffer: { } as GPUBuffer, size: 0, offset: 0 }
    private makeUniformBuffer(size: number, usage = GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST) {
        const bufferSize = size
        if (this.cachedUniformBuffer.offset + bufferSize > this.cachedUniformBuffer.size) {
            const size = Math.max(bufferSize || 256 * 16)
            this.cachedUniformBuffer = {
                buffer: this.device.createBuffer({ size, usage }),
                offset: 0,
                size,
            }
        }
        const { buffer, offset } = this.cachedUniformBuffer
        this.cachedUniformBuffer.offset = Math.ceil((offset + size) / 256) * 256
        return { buffer, offset, size }
    }
    array = cache((items: UniformValue[] & { usage?: number }) => {
        const list = { size: 0, uniforms: [] as { value: UniformValue, offset: number }[] }
        for (const value of items) {
            const offset = list.size
            if (Array.isArray(value)) {
                throw Error(`only typed array supported`)
            } else {
                list.size += value.byteLength
                list.uniforms.push({ value, offset })
            }
        }
        const { uniforms, size } = list,
            { buffer, offset } = this.makeUniformBuffer(size, items.usage)
        return { uniforms, buffer, offset, size } as BindingResource
    })
    bindings = cache((obj: { uniforms: Uniform[] }) => {
        return obj.uniforms.map(item => {
            if (Array.isArray(item)) {
                return this.array(item)
            } else if (item instanceof Sampler) {
                return this.sampler(item)
            } else if (item instanceof Texture) {
                return this.texture(item).createView(item.view)
            } else {
                throw Error(`unknown uniform type`)
            }
        })
    })

    bind = cache((pipeline: GPURenderPipeline | GPUComputePipeline, obj: { uniforms: Uniform[], bindingGroup: number, layout?: GPUBindGroupLayoutDescriptor }) => {
        const bindings = this.bindings(obj),
            index = obj.bindingGroup,
            layout = obj.layout ?
                this.device.createBindGroupLayout(obj.layout) :
                pipeline.getBindGroupLayout(index),
            entries = bindings.map((resource, binding) => ({ binding, resource })),
            group = this.device.createBindGroup({ layout, entries })
        return [index, group] as [number, GPUBindGroup]
    })

    private cachedPipelines = { } as Record<string, Record<string, CachedPipeline>>
    pipeline = (primitive: GeometryPrimitive, mat: Material) => {
        const cache = this.cachedPipelines[primitive] || (this.cachedPipelines[primitive] = { })
        if (cache[mat.id]) {
            return cache[mat.id]!
        }
        const code = [
            mat.prop.a < 1,
            mat.opts.wgsl?.frag,
            mat.opts.wgsl?.vert,
            mat.opts.texture ? 't' : '',
        ].join('###')
        if (cache[code]) {
            return cache[mat.id] = cache[code]!
        }
        return cache[mat.id] = cache[code] = this.buildPipeline(primitive, mat)
    }

    private cachedModules = { } as Record<string, GPUShaderModule>
    static parseShaderEntry(wgsl: string) {
        const match = wgsl.trim().match(/^fn ([^\(]+)/)
        return match ? { name: match[1]!, code: wgsl } : { name: wgsl, code: '' }
    }
    static defaultEntry = {
        vert: 'vertMain',
        frag: {
            'point-list': 'fragMainColor',
            'line-list': 'fragMainColor',
            'line-strip': 'fragMainColor',
            'triangle-list': 'fragMain',
            'triangle-strip': 'fragMain',
        }
    }
    private buildPipeline = cache((primitive: GeometryPrimitive, mat: Material) => {
        const { wgsl: { vert, frag } = { } } = mat.opts,
            id = Object.keys(this.cachedPipelines).length,
            vertEntry = Cache.parseShaderEntry(
                typeof vert === 'string' ? vert :
                primitive === 'fat-line-list' ? 'vertLineMain' :
                primitive === 'point-sprite' ? 'vertSpriteMain' :
                (vert?.[primitive] || Cache.defaultEntry.vert)),
            fragEntry = Cache.parseShaderEntry(
                typeof frag === 'string' ? frag :
                primitive === 'fat-line-list' ? 'fragMainColor' :
                primitive === 'point-sprite' ? (mat.opts.texture ? 'fragMainSprite' : 'fragMainColor') :
                ((frag || Cache.defaultEntry.frag)[primitive] || 'fragMainColor')),
            topology =
                primitive === 'fat-line-list' ? 'triangle-list' :
                primitive === 'point-sprite' ? 'triangle-list' :
                primitive,
            code = WGSL_CODE
                .replace('// @vert-extra-code', vertEntry.code ? `@vertex ` + vertEntry.code : '')
                .replace('// @frag-extra-code', fragEntry.code ? `@fragment ` + fragEntry.code : ''),
            module = this.cachedModules[code] || (this.cachedModules[code] = this.device.createShaderModule({ code })),
            pipeline = this.device.createRenderPipeline({
                layout: 'auto',
                vertex: {
                    module,
                    entryPoint: vertEntry.name,
                    // TODO
                    buffers: [{
                        arrayStride: 4 * 3,
                        attributes: [{
                            shaderLocation: 0,
                            offset: 0,
                            format: 'float32x3'
                        }]
                    }, {
                        arrayStride: 4 * 3,
                        attributes: [{
                            shaderLocation: 1,
                            offset: 0,
                            format: 'float32x3'
                        }]
                    }]
                },
                fragment: {
                    module,
                    entryPoint: fragEntry.name,
                    targets: [{
                        blend: mat.prop.a < 1 ? {
                            color: {
                                operation: 'add',
                                srcFactor: 'src-alpha',
                                dstFactor: 'one-minus-src-alpha',
                            },
                            alpha: {
                                operation: 'add',
                                srcFactor: 'src-alpha',
                                dstFactor: 'one',
                            }
                        } : undefined,
                        format: this.opts.fragmentFormat
                    }]
                },
                primitive: {
                    topology,
                    cullMode: 'back',
                    ...mat.opts.webgpu?.primitive,
                },
                depthStencil: {
                    depthWriteEnabled: mat.prop.a < 1 ? false : true,
                    depthCompare: 'greater',
                    format: this.opts.depthFormat,
                    ...mat.opts.webgpu?.depthStencil,
                },
                multisample: mat.opts.webgpu?.multisample || this.opts.multisample
            })
        return { pipeline, id }
    })
}
