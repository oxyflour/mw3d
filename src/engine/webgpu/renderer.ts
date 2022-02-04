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
		const arr = val instanceof Uint32Array ?
			new Uint32Array(buffer.getMappedRange()) :
			new Uint16Array(buffer.getMappedRange())
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
	uniforms = cache((mesh: Mesh | Camera) => {
		const map = { } as Record<string, { uniform: Uniform, buffer: GPUBuffer }>,
			list = [] as { uniform: Uniform, buffer: GPUBuffer }[]
		for (const uniform of mesh.uniforms) {
			const buffer = this.uniform(uniform.values)
			list.push(map[uniform.name] = { uniform, buffer })
		}
		return { list, map }
	})
	bind = cache((mesh: Mesh | Camera, mat: Material) => {
		const pipeline = this.pipeline(mat),
			uniforms = this.uniforms(mesh)
		return this.device.createBindGroup({
			layout: pipeline.getBindGroupLayout(mesh instanceof Camera ? 0 : 1),
			entries: uniforms.list.map(({ buffer }, binding) => ({
				binding,
				resource: { buffer }
			}))
		})
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
				//cullMode: 'back'
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
	private depthTexture: GPUTexture
	private renderTarget: GPUTexture

	private resize() {
		this.cache.size.width = this.width
		this.cache.size.height = this.height
		if (this.renderTarget) {
			this.renderTarget.destroy()
		}
		this.renderTarget = this.device.createTexture({
			size: this.cache.size,
			format: this.format,
			usage: GPUTextureUsage.RENDER_ATTACHMENT
		})
		if (this.depthTexture) {
			this.depthTexture.destroy()
		}
		this.depthTexture = this.device.createTexture({
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

	render(objs: Set<Obj3>, camera: Camera) {
		if (this.width !== this.cache.size.width ||
			this.height !== this.cache.size.height ||
			!this.depthTexture) {
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
					view: this.renderTarget.createView(),
					loadValue: { r: 0.5, g: 0.5, b: 0.5, a: 1.0 },
					storeOp: 'store',
				}],
				depthStencilAttachment: {
					view: this.depthTexture.createView(),
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
		for (const mesh of sorted) {
			const uniforms = this.cache.uniforms(mesh)
			for (const { buffer, uniform: { values } } of uniforms.list) {
				this.device.queue.writeBuffer(
					buffer,
					0,
					values.buffer,
					values.byteOffset,
					values.byteLength,
				)
			}
		}

		let pipeline: GPURenderPipeline,
			bindGroup: GPUBindGroup
		for (const mesh of sorted) {
			if (pipeline !== this.cache.pipeline(mesh.mat) && (pipeline = this.cache.pipeline(mesh.mat))) {
				pass.setPipeline(pipeline)
				pass.setBindGroup(0, this.cache.bind(camera, mesh.mat))
			}
			if (bindGroup !== this.cache.bind(mesh, mesh.mat) && (bindGroup = this.cache.bind(mesh, mesh.mat))) {
				pass.setBindGroup(1, bindGroup)
			}

			const attrs = this.cache.attrs(mesh.geo)
			pass.setVertexBuffer(0, attrs.map['a_position'].buffer)

			if (mesh.geo.indices) {
				const type = mesh.geo.indices instanceof Uint32Array ? 'uint32' : 'uint16'
				pass.setIndexBuffer(this.cache.idx(mesh.geo.indices), type)
				pass.drawIndexed(mesh.count, 1, mesh.offset, 0)
			} else {
				pass.draw(mesh.count, 1, mesh.offset, 0)
			}
		}

		pass.endPass()
		this.device.queue.submit([cmd.finish()])
	}
}
