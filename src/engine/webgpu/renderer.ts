/// <reference path="../../../node_modules/@webgpu/types/dist/index.d.ts" />

import Camera from "../camera"
import Material from "../material"
import Obj3 from "../obj3"
import Mesh from '../mesh'
import Light from '../light'

import Cache, { CachedUniform } from './cache'
import Geometry from "../geometry"

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

    private updateUniforms({ list }: { list: CachedUniform[] }) {
        for (const { buffer, offset, uniform: { values } } of list) {
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

    private cachedRenderPass = {
        objs: [] as { mesh: Mesh, mat: Material, geo: Geometry }[],
        bundles: [] as GPURenderBundle[]
    }
    private runRenderPass(
            pass: GPURenderPassEncoder | GPURenderBundleEncoder,
            sorted: Mesh[],
            lights: Light[],
            camera: Camera,
            pipelines: Record<number, GPURenderPipeline & { pipelineId: number }>) {
        let pipeline: GPURenderPipeline,
            mat: Material,
            geo: Geometry
        for (const mesh of sorted) {
            if (pipeline !== pipelines[mesh.mat.id] && (pipeline = pipelines[mesh.mat.id])) {
                pass.setPipeline(pipeline)
                pass.setBindGroup(...this.cache.bind(pipeline, camera))
                for (const light of lights) {
                    pass.setBindGroup(...this.cache.bind(pipeline, light))
                }
            }
            pass.setBindGroup(...this.cache.bind(pipeline, mesh))
            if (mat !== mesh.mat && (mat = mesh.mat)) {
                pass.setBindGroup(...this.cache.bind(pipeline, mesh.mat))
            }
            if (geo !== mesh.geo && (geo = mesh.geo)) {
                const attrs = this.cache.attrs(mesh.geo)
                for (const [slot, attr] of attrs.list.entries()) {
                    pass.setVertexBuffer(slot, attr.buffer)
                }
                if (geo.indices) {
                    const type = geo.indices instanceof Uint32Array ? 'uint32' : 'uint16'
                    pass.setIndexBuffer(this.cache.idx(mesh.geo.indices), type)
                }
            }
            if (geo.indices) {
                pass.drawIndexed(mesh.count, 1, mesh.offset, 0)
            } else {
                pass.draw(mesh.count, 1, mesh.offset, 0)
            }
        }
    }

    private cachedMaterials = { } as Record<number, boolean>
    render(objs: Set<Obj3>, camera: Camera) {
        if (this.width !== this.cache.size.width ||
            this.height !== this.cache.size.height ||
            !this.cache.depthTexture) {
            this.resize()
        }

        const meshes = [] as Mesh[],
            lights = [] as Light[],
            updated = [] as (Mesh | Light | Material)[],
            addToUpdated = (obj: Obj3) => (obj instanceof Mesh || obj instanceof Light) && updated.push(obj),
            pipelines = { } as Record<number, GPURenderPipeline & { pipelineId: number }>
        camera.updateIfNecessary().forEach(addToUpdated)
        for (const obj of objs) {
            obj.updateIfNecessary().forEach(addToUpdated)
            obj.walk(obj => {
                if (obj instanceof Mesh && obj.isVisible) {
                    meshes.push(obj)
                    pipelines[obj.mat.id] = this.cache.pipeline(obj.mat)
                    if (!this.cachedMaterials[obj.mat.id] &&
                        (this.cachedMaterials[obj.mat.id] = true)) {
                        updated.push(obj.mat)
                    }
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
        for (const obj of updated) {
            this.updateUniforms(this.cache.uniforms(obj))
        }

        const cmd = this.device.createCommandEncoder(),
            pass = cmd.beginRenderPass({
                colorAttachments: [{
                    view: this.context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    loadValue: { r: 1, g: 1, b: 1, a: 1.0 },
                    storeOp: 'store',
                    clearValue: { r: 1, g: 1, b: 1, a: 1.0 },
                }],
                depthStencilAttachment: {
                    view: this.cache.depthTexture.createView(),
                    depthLoadOp: 'clear',
                    depthClearValue: 1.0,
                    depthLoadValue: 1.0,
                    depthStoreOp: 'store',
                    stencilLoadOp: 'clear',
                    stencilLoadValue: 0,
                    stencilStoreOp: 'store'
                }
            })

        if (this.cachedRenderPass.objs.length !== sorted.length ||
            this.cachedRenderPass.objs.some((item, idx) =>
                item.mesh !== sorted[idx] &&
                item.geo !== sorted[idx].geo &&
                item.mat !== sorted[idx].mat)) {
            this.cachedRenderPass.objs = sorted.map(mesh => ({ mesh, geo: mesh.geo, mat: mesh.mat }))
            const encoder = this.device.createRenderBundleEncoder({
                colorFormats: [this.cache.opts.fragmentFormat],
                depthStencilFormat: this.cache.opts.depthFormat
            })
            this.runRenderPass(encoder, sorted, lights, camera, pipelines)
            this.cachedRenderPass.bundles = [encoder.finish()]
        }
        pass.executeBundles(this.cachedRenderPass.bundles)

        pass.end()
        this.device.queue.submit([cmd.finish()])
    }
}
