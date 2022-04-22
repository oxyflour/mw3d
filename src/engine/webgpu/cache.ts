/// <reference path="../../../node_modules/@webgpu/types/dist/index.d.ts" />
import { mat4, vec4 } from 'gl-matrix'

import cache from "../../utils/cache"
import Geometry, { Attr } from "../geometry"
import { Uniform } from '../uniform'
import Camera from "../camera"
import Mesh from "../mesh"
import Material from "../material"
import Light from "../light"

export interface CachedAttr {
    attr: Attr
    buffer: GPUBuffer
}

export interface CachedUniform {
    uniform: Uniform
    buffer: GPUBuffer
    offset: number
    size: number
}

export interface CachedBind {
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
        uniformBufferBatchSize?: number
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
        if (this.cachedUniformBuffer.offset + size > this.cachedUniformBuffer.size) {
            const size = this.opts.uniformBufferBatchSize || 256 * 16
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
    bindings = cache((obj: Camera | Mesh | Material | Light) => {
        const bindings = [] as CachedUniform[]
        for (const uniform of Object.values(obj.uniforms)) {
            const { buffer, offset, size } = this.makeUniformBuffer(uniform.value)
            bindings[uniform.binding] = { uniform, buffer, offset, size }
        }
        return bindings
    })

    bind = cache((pipeline: GPURenderPipeline, obj: Camera | Mesh | Material | Light) => {
        const bindings = this.bindings(obj),
            index = obj.bindingGroup,
            group = this.device.createBindGroup({
                layout: pipeline.getBindGroupLayout(index),
                entries: bindings.map(({ buffer, offset, size }, binding) => ({
                    binding,
                    resource: { buffer, offset, size }
                })),
            })
        return [index, group] as [number, GPUBindGroup]
    })

    private cachedPipelines = { } as Record<string, Record<string, GPURenderPipeline & { pipelineId: number }>>
    private cachedPrimitive = { } as Record<string, { primitive: GPUPrimitiveTopology }>
    pipeline = (primitive: GPUPrimitiveTopology, mat: Material) => {
        const cache = this.cachedPipelines[primitive] || (this.cachedPipelines[primitive] = { })
        if (cache[mat.id]) {
            return cache[mat.id]
        }
        const code = mat.shaders.wgsl + '###' + (mat.color.a < 1)
        if (cache[code]) {
            return cache[mat.id] = cache[code]
        }
        const geo = this.cachedPrimitive[primitive] || (this.cachedPrimitive[primitive] = { primitive })
        return cache[mat.id] = cache[code] = this.buildPipeline(geo, mat)
    }
    buildPipeline = cache((geo: { primitive: GPUPrimitiveTopology }, mat: Material) => {
        const code = mat.shaders.wgsl,
            pipelineId = Object.keys(this.cachedPipelines).length,
            module = this.device.createShaderModule({ code })
        return Object.assign(this.device.createRenderPipeline({
            vertex: {
                module,
                entryPoint: 'vertMain',
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
                entryPoint: 'fragMain',
                targets: [{
                    blend: mat.color.a < 1 ? {
                        color: {
                            operation: 'add',
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                        },
                        alpha: {
                            operation: 'add',
                            srcFactor: 'one',
                            dstFactor: 'zero',
                        }
                    } : undefined,
                    format: this.opts.fragmentFormat
                }]
            },
            primitive: {
                topology: geo.primitive,
                cullMode: 'back'
            },
            depthStencil: {
                depthWriteEnabled: true,
                depthCompare: 'less',
                format: this.opts.depthFormat,
            },
        }), { pipelineId })
    })
}
