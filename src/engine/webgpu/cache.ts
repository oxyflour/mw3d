import cache from "../../utils/cache"
import Geometry, { Attr } from "../geometry"
import Uniform from '../uniform'
import { mat4, vec4 } from 'gl-matrix'
import Camera from "../camera"
import Mesh from "../mesh"
import Material from "../material"
import Light from "../light"

interface CachedAttr {
    attr: Attr
    buffer: GPUBuffer
}

interface CachedUniform {
    uniform: Uniform
    buffer: GPUBuffer
    offset: number
    size: number
}

interface CachedBind {
    pipeline: GPURenderPipeline
    index: number
    buffers: GPUBuffer[]
    group: GPUBindGroup
}

export default class Cache {
    size = { width: 0, height: 0 }
    depthTexture: GPUTexture
    constructor(readonly device: GPUDevice, readonly opts: {
        fragmentFormat: GPUTextureFormat
        depthFormat: GPUTextureFormat
    }) { }
    idx = cache((val: Uint32Array | Uint16Array) => {
        const buffer = this.device.createBuffer({
            size: val.length * (val instanceof Uint32Array ? 4 : 2),
            usage: GPUBufferUsage.INDEX,
            mappedAtCreation: true
        })
        const map = buffer.getMappedRange(),
            arr = val instanceof Uint32Array ? new Uint32Array(map) : new Uint16Array(map)
        arr.set(val)
        buffer.unmap()
        return buffer
    })
    private makeAttrBuffer(val: Float32Array) {
        const buffer = this.device.createBuffer({
            size: val.length * 4,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        })
        new Float32Array(buffer.getMappedRange()).set(val)
        buffer.unmap()
        return buffer
    }
    attrs = cache((geo: Geometry) => {
        const map = { } as Record<string, CachedAttr>,
            list = [] as CachedAttr[]
        for (const attr of geo.attrs) {
            if (!(attr.values instanceof Float32Array)) {
                throw Error(`attr.values is not supported`)
            }
            const buffer = this.makeAttrBuffer(attr.values)
            list.push(map[attr.name] = { attr, buffer })
        }
        return { list, map }
    })

    private cachedUniformBuffer = { buffer: null as GPUBuffer | null, size: 0, offset: 0 }
    private makeUniformBuffer(val: mat4 | vec4) {
        const size = val.length * 4
        /*
         * FIXME: share buffer cause splashing problem
         */
        return {
            buffer: this.device.createBuffer({
                size,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
            }),
            offset: 0,
            size,
        }
        if (this.cachedUniformBuffer.offset + size > this.cachedUniformBuffer.size) {
            const size = 16 * 1024
            this.cachedUniformBuffer = {
                buffer: this.device.createBuffer({
                    size,
                    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
                }),
                offset: 0,
                size,
            }
        }
        const { buffer, offset } = this.cachedUniformBuffer
        this.cachedUniformBuffer.offset = Math.ceil((offset + size) / 256) * 256
        return { buffer, offset, size }
    }
    uniforms = cache((obj: Camera | Mesh | Material | Light) => {
        const map = { } as Record<string, CachedUniform>,
            list = [] as CachedUniform[]
        for (const uniform of obj.uniforms) {
            const { buffer, offset, size } = this.makeUniformBuffer(uniform.values)
            list.push(map[uniform.name] = { uniform, buffer, offset, size })
        }
        return { list, map }
    })

    private cachedBinds = [] as CachedBind[]
    bind = cache((pipeline: GPURenderPipeline, obj: Camera | Mesh | Material | Light) => {
        const uniforms = this.uniforms(obj),
            index =
                obj instanceof Camera ? 0 :
                obj instanceof Light ? 1 :
                obj instanceof Mesh ? 2 : 3,
            buffers = uniforms.list.map(item => item.buffer),
            offsets = uniforms.list.map(item => item.offset),
            cached = this.cachedBinds.find(item =>
                item.pipeline === pipeline &&
                item.index === index &&
                item.buffers.length === buffers.length &&
                item.buffers.every((buffer, idx) => buffer === buffers[idx])),
            group = cached ? cached.group : this.device.createBindGroup({
                // FIXME: `getBindGroupLayout` does not support dynamic offsets
                layout: pipeline.getBindGroupLayout(index),
                entries: uniforms.list.map(({ buffer, offset, size }, binding) => ({
                    binding,
                    resource: { buffer, offset, size }
                }))
            })
        // TODO: enable cache
        // this.cachedBinds.push({ pipeline, index, buffers, group })
        // TODO: enable dynamic offsets
        offsets
        // return [index, group, offsets] as [number, GPUBindGroup, number[]]
        return [index, group] as [number, GPUBindGroup]
    })

    private cachedPipelines = { } as Record<string, GPURenderPipeline & { pipelineId: number }>
    pipeline = cache((mat: Material) => {
        const code = mat.shaders.wgsl,
            key = `${code.vert}//${code.frag}`
        if (this.cachedPipelines[key]) {
            return this.cachedPipelines[key]
        }

        const pipelineId = Object.keys(this.cachedPipelines).length
        return this.cachedPipelines[key] = Object.assign(this.device.createRenderPipeline({
            vertex: {
                module: this.device.createShaderModule({ code: code.vert }),
                entryPoint: 'main',
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
                module: this.device.createShaderModule({ code: code.frag }),
                entryPoint: 'main',
                targets: [{
                    format: this.opts.fragmentFormat
                }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'back'
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: this.opts.depthFormat,
            }
        }), { pipelineId })
    })
}
