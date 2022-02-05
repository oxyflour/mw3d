/// <reference path="../../../node_modules/@webgpu/types/dist/index.d.ts" />

import Camera from "../camera"
import Material from "../material"
import Obj3 from "../obj3"
import Mesh from '../mesh'
import Light from '../light'

import Cache from './cache'

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
		const size = {
			width: this.width * devicePixelRatio,
			height: this.height * devicePixelRatio
		}
        cache.depthTexture = this.device.createTexture({
            size,
            format: cache.opts.depthFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
        this.context.configure({
            size,
            format: this.format,
            device: this.device,
        })
    }

    private updateUniforms(uniforms: ReturnType<Renderer['cache']['uniforms']>) {
        for (const { buffer, offset, uniform: { values } } of uniforms.list) {
            const array = values as Float32Array
            this.device.queue.writeBuffer(
                buffer,
                offset,
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
            lights = [] as Light[],
			pipelines = { } as Record<number, GPURenderPipeline & { pipelineId: number }>
        camera.updateIfNecessary()
        for (const obj of objs) {
            obj.updateIfNecessary()
            obj.walk(obj => {
                if (obj instanceof Mesh && obj.isVisible) {
                    meshes.push(obj)
					pipelines[obj.mat.id] = this.cache.pipeline(obj.mat)
                } else if (obj instanceof Light) {
                    lights.push(obj)
                }
            })
        }

        const sorted = meshes.sort((a, b) => 
            (a.renderOrder - b.renderOrder) ||
            (pipelines[a.mat.id].pipelineId - pipelines[b.mat.id].pipelineId) ||
            (a.mat.id - b.mat.id) ||
            (a.geo.id - b.geo.id))

        this.updateUniforms(this.cache.uniforms(camera))
        for (const light of lights) {
            this.updateUniforms(this.cache.uniforms(light))
        }
		let mat: Material
        for (const mesh of sorted) {
            this.updateUniforms(this.cache.uniforms(mesh))
			if (mat !== mesh.mat && (mat = mesh.mat)) {
                this.updateUniforms(this.cache.uniforms(mat))
			}
		}

        const cmd = this.device.createCommandEncoder(),
            pass = cmd.beginRenderPass({
                colorAttachments: [{
                    view: this.context.getCurrentTexture().createView(),
                    loadValue: { r: 1, g: 1, b: 1, a: 1.0 },
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

        let pipeline: GPURenderPipeline
        for (const mesh of sorted) {
            if (pipeline !== pipelines[mesh.mat.id] && (pipeline = pipelines[mesh.mat.id])) {
                pass.setPipeline(pipeline)
                pass.setBindGroup(...this.cache.bind(pipeline, camera))
                for (const light of lights) {
                    pass.setBindGroup(...this.cache.bind(pipeline, light))
                }
            }
			if (mat !== mesh.mat && (mat = mesh.mat)) {
                pass.setBindGroup(...this.cache.bind(pipeline, mesh.mat))
			}
            pass.setBindGroup(...this.cache.bind(pipeline, mesh))

            const attrs = this.cache.attrs(mesh.geo)
			for (const [slot, attr] of attrs.list.entries()) {
            	pass.setVertexBuffer(slot, attr.buffer)
			}
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
