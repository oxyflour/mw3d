/// <reference path="../../../node_modules/@webgpu/types/dist/index.d.ts" />

import vertShader from './shader/vert.wgsl?raw'
import fragShader from './shader/frag.wgsl?raw'

import Camera from "../camera"
import Geometry from "../geometry"
import Material from "../material"
import Obj3 from "../obj3"
import cache from "../../utils/cache"
import Mesh from '../mesh'

export default class Renderer {
	private device: GPUDevice
	private context: GPUCanvasContext
	private format: GPUTextureFormat
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

		const context = this.context = this.canvas.getContext('gpupresent')
		if (!context) {
			throw Error(`get context failed`)
		}

		const device = this.device = this.opts.canvasConfig?.device ||
				await adaptor.requestDevice(this.opts.deviceDescriptor),
			format = this.format = this.opts.canvasConfig.format || 'rgba8unorm'
		context.configure({ format, device, ...this.opts.canvasConfig })
		return this
	}
	static async create(canvas: HTMLCanvasElement) {
		return await new Renderer(canvas).init()
	}

	compileGeo = cache((geo: Geometry) => {
		const vertAttr = geo.attrs.find(attr => attr.name === 'a_position')
		if (!vertAttr) {
			throw Error(`a_position attr is required for geometry`)
		}
		const vertCount = (vertAttr.values as Float32Array).length / 3
		const vertBuffer = this.device.createBuffer({
			size: vertCount,
			usage: GPUBufferUsage.VERTEX,
			mappedAtCreation: true
		})
		new Float32Array(vertBuffer.getMappedRange()).set(vertAttr.values as Float32Array)
		vertBuffer.unmap()
		return { vertBuffer, vertCount }
	})

	compileMat = cache((mat: Material) => {
		const pipeline = this.device.createRenderPipeline({
			vertex: {
				module: this.device.createShaderModule({ code: vertShader }),
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
				module: this.device.createShaderModule({ code: fragShader }),
				entryPoint: 'main',
				targets: [{
					format: this.format
				}]
			},
			primitive: {
				topology: 'triangle-list'
			}
		})
		return pipeline
	})

	render(objs: Set<Obj3>, camera: Camera) {
		const meshes = [] as Mesh[]
		for (const obj of objs) {
			obj.walk(obj => {
				if (obj instanceof Mesh) {
					meshes.push(obj)
				}
			})
		}

		const cmdEncoder = this.device.createCommandEncoder(),
			textureView = this.context.getCurrentTexture().createView(),
			passEncoder = cmdEncoder.beginRenderPass({
				colorAttachments: [{
					view: textureView,
					loadValue: { r: 0, g: 0, b: 0, a: 1 },
					storeOp: 'store',
				}]
			})

		for (const mesh of meshes) {
			passEncoder.setPipeline(this.compileMat(mesh.mat))
			const { vertBuffer, vertCount } = this.compileGeo(mesh.geo)
			passEncoder.setVertexBuffer(0, vertBuffer)
			passEncoder.draw(vertCount)
		}

		passEncoder.endPass()
		this.device.queue.submit([cmdEncoder.finish()])
	}
}
