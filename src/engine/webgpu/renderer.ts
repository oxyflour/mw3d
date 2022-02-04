/// <reference path="../../../node_modules/@webgpu/types/dist/index.d.ts" />

import Camera from "../camera"
import Geometry, { Attr } from "../geometry"
import Material from "../material"
import Obj3 from "../obj3"
import cache from "../../utils/cache"
import Mesh from '../mesh'
import Light from '../light'
import Uniform from '../uniform'
import { mat4, vec4 } from 'gl-matrix'

class Cache {
    size = { width: 0, height: 0 }
	depthTexture: GPUTexture
	constructor(readonly device: GPUDevice, readonly opts: {
		fragmentFormat: GPUTextureFormat
		depthFormat: GPUTextureFormat
	}) { }
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
	uniforms = cache((obj: Camera | Mesh | Material) => {
		const map = { } as Record<string, { uniform: Uniform, buffer: GPUBuffer }>,
			list = [] as { uniform: Uniform, buffer: GPUBuffer }[]
		for (const uniform of obj.uniforms) {
			const buffer = this.uniform(uniform.values)
			list.push(map[uniform.name] = { uniform, buffer })
		}
		return { list, map }
	})
	bind = cache((mat: Material, obj: Camera | Mesh | Material) => {
		const pipeline = this.pipeline(mat),
			uniforms = this.uniforms(obj),
			index = obj instanceof Camera ? 0 : obj instanceof Mesh ? 1 : 2,
			group = this.device.createBindGroup({
				layout: pipeline.getBindGroupLayout(index),
				entries: uniforms.list.map(({ buffer }, binding) => ({
					binding,
					resource: { buffer }
				}))
			})
		return [index, group] as [number, GPUBindGroup]
	})
	pipeline = cache((mat: Material) => {
		const code = mat.shaders.wgsl
		return this.device.createRenderPipeline({
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

export default class Renderer {
	private cache: Cache
	private device: GPUDevice
	private format: GPUTextureFormat
	private context: GPUCanvasContext
	private constructor(
		public readonly canvas: HTMLCanvasElement,
		private readonly opts = { } as {
			adaptorOptions?: GPURequestAdapterOptions
			deviceDescriptor?: GPUDeviceDescriptor
			canvasConfig?: GPUCanvasConfiguration
		}) {
	}
	private async init() {
		const adaptor = await navigator.gpu.requestAdapter(this.opts.adaptorOptions)
		if (!adaptor) {
			throw Error(`get gpu device failed`)
		}

		const context = this.context = this.canvas.getContext('webgpu')
		if (!context) {
			throw Error(`get context failed`)
		}

		const device = this.device = this.opts.canvasConfig?.device ||
				await adaptor.requestDevice(this.opts.deviceDescriptor),
			format = this.format = this.opts.canvasConfig?.format || this.context.getPreferredFormat(adaptor)
		this.cache = new Cache(device, {
			fragmentFormat: format,
			depthFormat: 'depth24plus',
		})

		this.width = this.canvas.clientWidth
		this.height = this.canvas.clientHeight
		this.resize()
		return this
	}
	static async create(canvas: HTMLCanvasElement) {
		return await new Renderer(canvas).init()
	}

	width: number
	height: number
	private resize() {
		const { cache } = this
		cache.size.width = this.width
		cache.size.height = this.height
		if (cache.depthTexture) {
			cache.depthTexture.destroy()
		}
		cache.depthTexture = this.device.createTexture({
			size: this.cache.size,
			format: this.cache.opts.depthFormat,
			usage: GPUTextureUsage.RENDER_ATTACHMENT,
		})
		this.context.configure({
			device: this.device,
			format: this.format,
			size: this.cache.size,
		})
	}

	private updateUniforms(uniforms: ReturnType<Renderer['cache']['uniforms']>) {
		for (const { buffer, uniform: { values } } of uniforms.list) {
			const array = values as Float32Array
			this.device.queue.writeBuffer(
				buffer,
				0,
				array.buffer,
				array.byteOffset,
				array.byteLength,
			)
		}
	}

	render(objs: Set<Obj3>, camera: Camera) {
		if (this.width !== this.cache.size.width ||
			this.height !== this.cache.size.height ||
			!this.cache.depthTexture) {
			this.resize()
		}

        const meshes = [] as Mesh[],
            lights = [] as Light[]
        camera.updateIfNecessary()
        for (const obj of objs) {
            obj.updateIfNecessary()
            obj.walk(obj => {
                if (obj instanceof Mesh && obj.isVisible) {
                    meshes.push(obj)
                } else if (obj instanceof Light) {
                    lights.push(obj)
                }
            })
        }

		const cmd = this.device.createCommandEncoder(),
			pass = cmd.beginRenderPass({
				colorAttachments: [{
					view: this.context.getCurrentTexture().createView(),
					loadValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
					storeOp: 'store',
				}],
				depthStencilAttachment: {
					view: this.cache.depthTexture.createView(),
					depthLoadValue: 1.0,
					depthStoreOp: 'store',
					stencilLoadValue: 0,
					stencilStoreOp: 'store'
				}
			})

        const sorted = meshes.sort((a, b) => 
            (a.renderOrder - b.renderOrder) ||
            (a.mat.id - b.mat.id) ||
            (a.geo.id - b.geo.id))
		this.updateUniforms(this.cache.uniforms(camera))

		let pipeline: GPURenderPipeline,
			bind: [number, GPUBindGroup],
			vertexBuffer: GPUBuffer,
			indexBuffer: GPUBuffer
		for (const mesh of sorted) {
			this.updateUniforms(this.cache.uniforms(mesh))

			const currentPipeline = this.cache.pipeline(mesh.mat)
			if (pipeline !== currentPipeline && (pipeline = currentPipeline)) {
				pass.setPipeline(pipeline)
				pass.setBindGroup(...this.cache.bind(mesh.mat, camera))
				pass.setBindGroup(...this.cache.bind(mesh.mat, mesh.mat))
				this.updateUniforms(this.cache.uniforms(mesh.mat))
			}

			const currentBind = this.cache.bind(mesh.mat, mesh)
			if (bind !== currentBind && (bind = currentBind)) {
				pass.setBindGroup(...bind)
			}

			const attrs = this.cache.attrs(mesh.geo),
				currentVertexBuffer = attrs.map['a_position'].buffer
			if (vertexBuffer !== currentVertexBuffer && (vertexBuffer = currentVertexBuffer)) {
				pass.setVertexBuffer(0, vertexBuffer)
			}
			if (mesh.geo.indices) {
				const type = mesh.geo.indices instanceof Uint32Array ? 'uint32' : 'uint16',
					currentIndexBuffer = this.cache.idx(mesh.geo.indices)
				if (indexBuffer !== currentIndexBuffer && (indexBuffer = currentIndexBuffer)) {
					pass.setIndexBuffer(indexBuffer, type)
				}
				pass.drawIndexed(mesh.count, 1, mesh.offset, 0)
			} else {
				pass.draw(mesh.count, 1, mesh.offset, 0)
			}
		}

		pass.endPass()
		this.device.queue.submit([cmd.finish()])
	}
}
