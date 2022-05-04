/// <reference path="../../../node_modules/@webgpu/types/dist/index.d.ts" />

import Camera from "../camera"
import Material from "../material"
import Obj3, { Scene } from "../obj3"
import Mesh from '../mesh'
import Light from '../light'

import Cache, { BindingResource } from './cache'
import Geometry from "../geometry"
import { vec4 } from "gl-matrix"
import { Sampler, Texture, UniformValue } from "../uniform"

export default class Renderer {
    private cache!: Cache
    private device!: GPUDevice
    private format!: GPUTextureFormat
    private context!: GPUCanvasContext
    private constructor(
        public readonly canvas: HTMLCanvasElement | OffscreenCanvas,
        private readonly opts = { } as {
            size?: { width: number, height: number }
            devicePixelRatio?: number
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

        const context = this.context = this.canvas.getContext('webgpu') as GPUCanvasContext
        if (!context) {
            throw Error(`get context failed`)
        }

        const device = this.device = this.opts.canvasConfig?.device ||
                await adaptor.requestDevice(this.opts.deviceDescriptor)
        this.format = this.opts.canvasConfig?.format || this.context.getPreferredFormat(adaptor)
        this.width = this.opts.size?.width || (this.canvas as HTMLCanvasElement).clientWidth || 100
        this.height = this.opts.size?.height || (this.canvas as HTMLCanvasElement).clientHeight || 100

        this.renderSize = {
            width: this.width * this.devicePixelRatio,
            height: this.height * this.devicePixelRatio,
        }
        this.cache = new Cache(device, {
            size: this.renderSize,
            fragmentFormat: this.format,
            depthFormat: 'depth24plus',
        })
        this.context.configure({
            size: this.renderSize,
            format: this.format,
            device: this.device,
            compositingAlphaMode: 'premultiplied',
        })

        return this
    }
    static async create(canvas: HTMLCanvasElement | OffscreenCanvas, opts?: Renderer['opts']) {
        return await new Renderer(canvas, opts).init()
    }

    width = 100
    height = 100
    private renderSize = { width: 100, height: 100 }
    get devicePixelRatio() {
        return this.opts.devicePixelRatio || globalThis.devicePixelRatio || 1
    }
    private resize() {
        this.renderSize = {
            width: this.width * this.devicePixelRatio,
            height: this.height * this.devicePixelRatio,
        }
        this.cache.resize(this.renderSize)
        this.context.configure({
            size: this.renderSize,
            format: this.format,
            device: this.device,
            compositingAlphaMode: 'premultiplied',
        })
    }

    private updateUniforms(bindings: BindingResource[]) {
        for (const binding of bindings) {
            const { uniforms } = binding,
                { buffer, offset = -1 } = binding as GPUBufferBinding
            if (buffer && offset >= 0) {
                const start = offset
                for (const { value, offset } of uniforms || []) {
                    if (Array.isArray(value)) {
                        throw Error(`array is not supported`)
                    } else if (value instanceof Sampler || value instanceof Texture) {
                        // pass
                    } else {
                        this.device.queue.writeBuffer(
                            buffer,
                            start + offset,
                            value.buffer,
                            value.byteOffset,
                            value.byteLength,
                        )
                    }
                }
            }
        }
    }

    private cachedRenderPass = {
        objs: [] as { mesh: Mesh, mat: Material, geo: Geometry }[],
        bundles: [] as GPURenderBundle[],
    }
    private runRenderPass(
            pass: GPURenderPassEncoder | GPURenderBundleEncoder,
            sorted: Mesh[],
            camera: Camera) {
        let pipeline!: GPURenderPipeline,
            mat!: Material,
            geo!: Geometry
        for (const mesh of sorted) {
            const cached = this.cache.pipeline(mesh.geo.type, mesh.mat)
            if (pipeline !== cached && (pipeline = cached)) {
                pass.setPipeline(pipeline)
                pass.setBindGroup(...this.cache.bind(pipeline, camera))
                pass.setBindGroup(...this.cache.bind(pipeline, mesh.mat))
                pass.setBindGroup(...this.cache.bind(pipeline, this))
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
                    pass.setIndexBuffer(...this.cache.idx(geo.indices))
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

    private readonly lightDummy = new Light()
    readonly bindingGroup = 0
    readonly uniforms = [
        [new Float32Array([0, 0])],
        [new Int32Array([0])],
        [],
    ] as [UniformValue[], UniformValue[], UniformValue[]]
    private buildRenderUnifroms(lights: Light[]) {
        const [[canvasSize], [lightNum], lightList] = this.uniforms
        lightNum![0] = lights.length
        canvasSize![0] = this.renderSize.width
        canvasSize![1] = this.renderSize.height
        lightList.length = 0
        for (let i = 0; i < 4; i ++) {
            const light = lights[i] || this.lightDummy
            for (const uniforms of light.uniforms) {
                lightList.push(...uniforms)
            }
        }
        return this.cache.bindings(this)
    }

    private cachedRenderList = {
        list: [] as Obj3[],
        updated: [] as (Mesh | Light | Material)[],
        addToUpdated: (obj: Obj3 | Material) =>
            (obj instanceof Mesh || obj instanceof Light || obj instanceof Material) &&
            this.cachedRenderList.updated.push(obj),
        opaque: [] as Mesh[],
        translucent: [] as Mesh[],
        lights: [] as Light[],
    }
    private statics = { ticks: [] as number[], frameTime: 0 }
    render(scene: Scene, camera: Camera, opts = { } as {
        depthTexture?: Texture
        colorTexture?: Texture
    }) {
        const start = performance.now()
        if (this.width * this.devicePixelRatio !== this.renderSize.width ||
            this.height * this.devicePixelRatio !== this.renderSize.height) {
            this.resize()
        }

        const { list, updated, addToUpdated } = this.cachedRenderList
        list.length = updated.length = 0
        camera.updateIfNecessary(addToUpdated)
        // TODO: enable this
        // Obj3.update(objs)
        for (const obj of scene) {
            obj.updateIfNecessary(addToUpdated)
            obj.walk(obj => list.push(obj))
        }

        const { opaque, translucent, lights } = this.cachedRenderList
        opaque.length = translucent.length = lights.length = 0
        for (const obj of list) {
            if (obj instanceof Mesh && obj.isVisible) {
                obj.mat.updateIfNecessary(addToUpdated)
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

        this.updateUniforms(this.buildRenderUnifroms(lights))
        this.updateUniforms(this.cache.bindings(camera))
        for (const obj of updated) {
            this.updateUniforms(this.cache.bindings(obj))
        }

        const cmd = this.device.createCommandEncoder(),
            pass = cmd.beginRenderPass({
                colorAttachments: [{
                    view: opts.colorTexture ?
                        this.cache.texture(opts.colorTexture).createView() :
                        this.context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    loadValue: { r: 1, g: 1, b: 1, a: 1.0 },
                    storeOp: 'store',
                    clearValue: { r: 1, g: 1, b: 1, a: 1.0 },
                }],
                depthStencilAttachment: {
                    view: opts.depthTexture ?
                        this.cache.texture(opts.depthTexture).createView() :
                        this.cache.depthTexture.createView(),
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
            this.runRenderPass(encoder, sorted, camera)
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
