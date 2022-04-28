/// <reference path="../../../node_modules/@webgpu/types/dist/index.d.ts" />

import Camera from "../camera"
import Material from "../material"
import Obj3 from "../obj3"
import Mesh from '../mesh'
import Light from '../light'

import Cache, { CachedUniform } from './cache'
import Geometry from "../geometry"
import { vec4 } from "gl-matrix"

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
            compositingAlphaMode: 'premultiplied',
        })
    }

    private updateUniforms(bindings: CachedUniform[]) {
        for (const { buffer, offset, uniforms } of bindings) {
            const start = offset
            for (const { value, offset } of uniforms) {
                const array =
                    typeof value === 'number' ? new Float32Array([value]) :
                    value instanceof Float32Array ? value :
                    new Float32Array(value)
                this.device.queue.writeBuffer(
                    buffer,
                    start + offset,
                    array.buffer,
                    array.byteOffset,
                    array.byteLength,
                )
            }
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
            camera: Camera) {
        let pipeline: GPURenderPipeline,
            mat: Material,
            geo: Geometry
        for (const mesh of sorted) {
            const cached = this.cache.pipeline(mesh.geo.type, mesh.mat)
            if (pipeline !== cached && (pipeline = cached)) {
                pass.setPipeline(pipeline)
                pass.setBindGroup(...this.cache.bind(pipeline, camera))
                pass.setBindGroup(...this.cache.bind(pipeline, mesh.mat))
                for (const light of lights) {
                    pass.setBindGroup(...this.cache.bind(pipeline, light))
                }
            }
            if (mat !== mesh.mat && (mat = mesh.mat)) {
                pass.setBindGroup(...this.cache.bind(pipeline, mesh.mat))
            }
            if (geo !== mesh.geo && (geo = mesh.geo)) {
                const attrs = this.cache.attrs(mesh.geo)
                for (const [slot, { buffer }] of attrs.entries()) {
                    pass.setVertexBuffer(slot, buffer)
                }
                if (geo.indices) {
                    const type = geo.indices instanceof Uint32Array ? 'uint32' : 'uint16'
                    pass.setIndexBuffer(this.cache.idx(mesh.geo.indices), type)
                }
            }
            pass.setBindGroup(...this.cache.bind(pipeline, mesh))
            const count = mesh.count > 0 ? mesh.count : mesh.geo.count
            if (geo.indices) {
                pass.drawIndexed(count, 1, mesh.offset, 0)
            } else {
                pass.draw(count, 1, mesh.offset, 0)
            }
        }
    }

    private cachedRenderList = {
        list: [] as Obj3[],
        updated: [] as (Mesh | Light | Material)[],
        addToUpdated: (obj: Obj3) => (obj instanceof Mesh || obj instanceof Light) && this.cachedRenderList.updated.push(obj),
        opaque: [] as Mesh[],
        translucent: [] as Mesh[],
        lights: [] as Light[],
    }
    private statics = { ticks: [] as number[], frameTime: 0 }
    render(objs: Set<Obj3>, camera: Camera) {
        const start = performance.now()

        if (this.width !== this.cache.size.width ||
            this.height !== this.cache.size.height ||
            !this.cache.depthTexture) {
            this.resize()
        }

        const { list, updated, addToUpdated } = this.cachedRenderList
        list.length = updated.length = 0
        camera.updateIfNecessary(addToUpdated)
        // TODO: enable this
        // Obj3.update(objs)
        for (const obj of objs) {
            obj.updateIfNecessary(addToUpdated)
            obj.walk(obj => list.push(obj))
        }

        const { opaque, translucent, lights } = this.cachedRenderList
        opaque.length = translucent.length = lights.length = 0
        for (const obj of list) {
            if (obj instanceof Mesh && obj.isVisible) {
                if (obj.mat.needsUpdate()) {
                    updated.push(obj.mat)
                    obj.mat.update()
                }
                if (obj.mat.prop.a < 1) {
                    translucent.push(obj)
                } else {
                    opaque.push(obj)
                }
            } else if (obj instanceof Light) {
                lights.push(obj)
            }
        }

        const { pipeline } = this.cache,
            opaqueSorted = opaque.sort((a, b) => 
                (a.renderOrder - b.renderOrder) ||
                (pipeline(a.geo.type, a.mat).pipelineId - pipeline(b.geo.type, b.mat).pipelineId) ||
                (a.mat.id - b.mat.id) ||
                (a.geo.id - b.geo.id)),
            transSorted = (translucent as (Mesh & { cameraDist: number })[])
                .map(item => ((item.cameraDist = vec4.dist(item.center, camera.worldPosition)), item))
                .sort((a, b) => b.cameraDist - a.cameraDist),
            sorted = opaqueSorted.concat(transSorted)

        this.updateUniforms(this.cache.bindings(camera))
        for (const obj of updated) {
            this.updateUniforms(this.cache.bindings(obj))
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
                    depthStoreOp: 'store',
                }
            })

        if (this.cachedRenderPass.objs.length !== sorted.length ||
            this.cachedRenderPass.objs.some((item, idx) => {
                const mesh = sorted[idx]
                return item.mesh !== mesh || item.geo !== mesh.geo || item.mat !== mesh.mat
            })) {
            this.cachedRenderPass.objs = sorted.map(mesh => ({ mesh, geo: mesh.geo, mat: mesh.mat }))
            const encoder = this.device.createRenderBundleEncoder({
                colorFormats: [this.cache.opts.fragmentFormat],
                depthStencilFormat: this.cache.opts.depthFormat
            })
            this.runRenderPass(encoder, sorted, lights, camera)
            this.cachedRenderPass.bundles = [encoder.finish()]
        }
        pass.executeBundles(this.cachedRenderPass.bundles)

        pass.end()
        this.device.queue.submit([cmd.finish()])

        const { ticks } = this.statics
        ticks.push(performance.now() - start)
        if (ticks.length > 60 * 20) {
            this.statics.frameTime = ticks.reduce((a, b) => a + b, 0) / ticks.length
            ticks.splice(0, 60)
        }
    }
}
