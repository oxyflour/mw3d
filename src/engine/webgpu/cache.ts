import cache from "../../utils/cache"
import Geometry, { Attr } from "../geometry"
import Uniform from '../uniform'
import { mat4, vec4 } from 'gl-matrix'
import Camera from "../camera"
import Mesh from "../mesh"
import Material from "../material"
import Light from "../light"

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
    attr = cache((val: Float32Array) => {
        const buffer = this.device.createBuffer({
            size: val.length * 4,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true
        })
        new Float32Array(buffer.getMappedRange()).set(val)
        buffer.unmap()
        return buffer
    })
    attrs = cache((geo: Geometry) => {
        const map = { } as Record<string, { attr: Attr, buffer: GPUBuffer }>,
            list = [] as { attr: Attr, buffer: GPUBuffer }[]
        for (const attr of geo.attrs) {
            if (!(attr.values instanceof Float32Array)) {
                throw Error(`attr.values is not supported`)
            }
            const buffer = this.attr(attr.values)
            list.push(map[attr.name] = { attr, buffer })
        }
        return { list, map }
    })
    uniform = cache((val: mat4 | vec4) => {
        const buffer = this.device.createBuffer({
            size: 4 * val.length,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        })
        return buffer
    })
    uniforms = cache((obj: Camera | Mesh | Material | Light) => {
        const map = { } as Record<string, { uniform: Uniform, buffer: GPUBuffer }>,
            list = [] as { uniform: Uniform, buffer: GPUBuffer }[]
        for (const uniform of obj.uniforms) {
            const buffer = this.uniform(uniform.values)
            list.push(map[uniform.name] = { uniform, buffer })
        }
        return { list, map }
    })
    bind = cache((pipeline: GPURenderPipeline, obj: Camera | Mesh | Material | Light) => {
        const uniforms = this.uniforms(obj),
            index =
                obj instanceof Camera ? 0 :
                obj instanceof Light ? 1 :
                obj instanceof Mesh ? 2 : 3,
            group = this.device.createBindGroup({
                layout: pipeline.getBindGroupLayout(index),
                entries: uniforms.list.map(({ buffer }, binding) => ({
                    binding,
                    resource: { buffer }
                }))
            })
        return [index, group] as [number, GPUBindGroup]
    })
	private cachedPipelines = { } as Record<string, GPURenderPipeline>
    pipeline = cache((mat: Material) => {
        const code = mat.shaders.wgsl,
			key = `${code.vert}//${code.frag}`
		if (this.cachedPipelines[key]) {
			return this.cachedPipelines[key]
		}

        return this.cachedPipelines[key] = this.device.createRenderPipeline({
            vertex: {
                module: this.device.createShaderModule({ code: code.vert }),
                entryPoint: 'main',
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
        })
    })
}
