/// <reference path="../../../node_modules/@webgpu/types/dist/index.d.ts" />
import { mat4, vec4 } from 'gl-matrix'

import cache from "../../utils/cache"
import Geometry from "../geometry"
import { Uniform, UniformDefine, UniformValue } from '../uniform'
import Camera from "../camera"
import Mesh from "../mesh"
import Material from "../material"
import Light from "../light"

export interface CachedAttr {
    buffer: GPUBuffer
}

export interface CachedUniform {
    uniforms: { value: UniformValue, offset: number }[]
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
    private cachedDepthTexture: GPUTexture
    get depthTexture() {
        return this.cachedDepthTexture
    }
    constructor(readonly device: GPUDevice, readonly opts: {
        size: { width: number, height: number }
        fragmentFormat: GPUTextureFormat
        depthFormat: GPUTextureFormat
        uniformBufferBatchSize?: number
    }) {
        this.cachedDepthTexture = this.device.createTexture({
            size: opts.size,
            format: this.opts.depthFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
    }
    resize(size: { width: number, height: number }) {
        this.cachedDepthTexture.destroy()
        this.cachedDepthTexture = this.device.createTexture({
            size,
            format: this.opts.depthFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
    }
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
        const list = [] as CachedAttr[]
        for (const array of [geo.positions, geo.normals]) {
            if (!(array instanceof Float32Array)) {
                throw Error(`attr.values is not supported`)
            }
            const buffer = this.makeAttrBuffer(array)
            list.push({ buffer })
        }
        return list
    })

    private cachedUniformBuffer = { buffer: null as GPUBuffer | null, size: 0, offset: 0 }
    private makeUniformBuffer(size: number) {
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
    bindings = cache((obj: { uniforms: Uniform[] }) => {
        const buffers = [] as { size: 0, uniforms: { value: UniformValue, offset: number }[] }[],
            sorted = obj.uniforms
                .map(item => (item as UniformDefine).value ? item as UniformDefine : { value: item as UniformValue })
                .map((item, order) => ({ order, binding: 0, ...item }))
                .sort((a, b) => (a.binding - b.binding) || (a.order - b.order))
        for (const uniform of sorted) {
            const { binding, value } = uniform,
                item = buffers[binding] || (buffers[binding] = { size: 0, uniforms: [] }),
                offset = item.size
            if (Array.isArray(value)) {
                throw Error(`array type is not supported`)
            }
            item.size += value.byteLength
            item.uniforms.push({ value, offset })
        }
        const bindings = [] as CachedUniform[]
        for (const [binding, { uniforms, size }] of buffers.entries()) {
            const { buffer, offset } = this.makeUniformBuffer(size)
            bindings[binding] = { uniforms, buffer, offset, size }
        }
        return bindings
    })

    bind = cache((pipeline: GPURenderPipeline, obj: { uniforms: Uniform[], bindingGroup: number }) => {
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
        const code = [mat.shaders.code, mat.prop.a < 1, mat.shaders.entry.frag, mat.shaders.entry.vert].join('###')
        if (cache[code]) {
            return cache[mat.id] = cache[code]
        }
        const geo = this.cachedPrimitive[primitive] || (this.cachedPrimitive[primitive] = { primitive })
        return cache[mat.id] = cache[code] = this.buildPipeline(geo, mat)
    }

    buildPipeline = cache((geo: { primitive: GPUPrimitiveTopology }, mat: Material) => {
        const { code, entry: { vert, frag } } = mat.shaders,
            pipelineId = Object.keys(this.cachedPipelines).length,
            module = this.device.createShaderModule({ code })
        return Object.assign(this.device.createRenderPipeline({
            vertex: {
                module,
                entryPoint: typeof vert === 'string' ? vert : vert[geo.primitive],
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
                entryPoint: typeof frag === 'string' ? frag : frag[geo.primitive],
                targets: [{
                    blend: mat.prop.a < 1 ? {
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
