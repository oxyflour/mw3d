import Camera from "../camera"
import Material from "../material"
import Obj3, { Scene } from "../obj3"
import Mesh from '../mesh'
import Light from '../light'

import Cache, { BindingResource } from './cache'
import Geometry from "../geometry"
import { vec4 } from "gl-matrix"
import { Sampler, Texture, UniformValue } from "../uniform"
import { ClipMeshes } from "./clip"
import Renderer, { RendererOptions } from "../renderer"

const MAX_LIGHTS = 4

type RenderMesh = Mesh & { geo: Geometry, mat: Material }

export default class WebGPURenderer extends Renderer {
    constructor(
        canvas: HTMLCanvasElement | OffscreenCanvas,
        override readonly opts: RendererOptions & {
            webgpu?: {
                adaptorOptions?: GPURequestAdapterOptions
                deviceDescriptor?: GPUDeviceDescriptor
                canvasConfig?: GPUCanvasConfiguration
            }
        }
    ) {
        super(canvas, opts)
    }
    private cache!: Cache
    private device!: GPUDevice
    private format!: GPUTextureFormat
    private context!: GPUCanvasContext
    private async init() {
        const opts = this.opts.webgpu || { },
            adaptor = await navigator.gpu.requestAdapter(opts.adaptorOptions)
        if (!adaptor) {
            throw Error(`get gpu device failed`)
        }

        const context = this.context = this.canvas.getContext('webgpu') as GPUCanvasContext
        if (!context) {
            throw Error(`get context failed`)
        }

        const device = this.device = opts.canvasConfig?.device ||
                await adaptor.requestDevice(opts.deviceDescriptor)
        this.format = opts.canvasConfig?.format || navigator.gpu.getPreferredCanvasFormat()
        this.width = this.opts.size?.width || (this.canvas as HTMLCanvasElement).clientWidth || 100
        this.height = this.opts.size?.height || (this.canvas as HTMLCanvasElement).clientHeight || 100

        this.renderSize = {
            width: this.canvas.width = this.width * this.devicePixelRatio,
            height: this.canvas.height = this.height * this.devicePixelRatio,
        }
        this.cache = new Cache(device, {
            size: this.renderSize,
            fragmentFormat: this.format,
            depthFormat: 'depth24plus-stencil8',
            multisample: { count: this.opts.sampleCount },
        })
        this.context.configure({
            size: this.renderSize,
            format: this.format,
            device: this.device,
            alphaMode: 'premultiplied',
        })

        return this
    }
    static async create(canvas: HTMLCanvasElement | OffscreenCanvas, opts = { } as RendererOptions) {
        return await new WebGPURenderer(canvas, opts).init()
    }

    width = 100
    height = 100
    private renderSize = { width: 100, height: 100 }
    get devicePixelRatio() {
        return this.opts.devicePixelRatio || globalThis.devicePixelRatio || 1
    }
    private resize() {
        this.renderSize = {
            width: this.canvas.width = this.width * this.devicePixelRatio,
            height: this.canvas.height = this.height * this.devicePixelRatio,
        }
        this.cache.resize(this.renderSize)
        this.context.configure({
            size: this.renderSize,
            format: this.format,
            device: this.device,
            alphaMode: 'premultiplied',
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
        objs: [] as { mesh: Mesh, mat: Material, geo: Geometry, offset: number, count: number }[],
        bundles: [] as GPURenderBundle[],
        compare(sorted: Mesh[]) {
            return this.objs.length !== sorted.length || this.objs.some((item, idx) => {
                const mesh = sorted[idx]
                return item.mesh !== mesh || item.geo !== mesh.geo || item.mat !== mesh.mat ||
                    item.offset !== mesh.offset || item.count !== mesh.count
            })
        }
    }
    private runRenderPass(
            pass: GPURenderPassEncoder | GPURenderBundleEncoder,
            sorted: (Mesh & { geo: Geometry, mat: Material })[],
            camera: Camera) {
        let pipeline!: GPURenderPipeline,
            mat!: Material,
            geo!: Geometry
        for (const mesh of sorted) {
            const cache = this.cache.pipeline(mesh.geo.type, mesh.mat)
            if (pipeline !== cache.pipeline && (pipeline = cache.pipeline)) {
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

    readonly bindingGroup = 0
    readonly uniforms = [
        [new Float32Array([0, 0])],
        [new Int32Array([0])],
        Array(MAX_LIGHTS).fill(0).map(() => new Light().uniforms.flat()).flat(),
    ] as [[UniformValue], [UniformValue], UniformValue[]]
    private buildRenderUnifroms(lights: Light[]) {
        const [[canvasSize], [lightNum], lightUniforms] = this.uniforms
        lightNum[0] = lights.length
        canvasSize[0] = this.renderSize.width
        canvasSize[1] = this.renderSize.height
        let index = 0
        for (const { uniforms } of lights) {
            for (const arr of uniforms) {
                for (const src of arr) {
                    const dst = lightUniforms[index ++]
                    for (let i = 0; dst && i < src.length && i < dst.length; i ++) {
                        dst[i] = src[i]!
                    }
                }
            }
        }
        return this.cache.bindings(this)
    }

    readonly clearColor = { r: 0, g: 0, b: 0, a: 0 }
    private cachedRenderList = {
        revs: { } as Record<number, number>,
        list: [] as Obj3[],
        updated: new Set<Mesh | Light | Material>(),
        opaque: [] as RenderMesh[],
        translucent: [] as RenderMesh[],
        lights: [] as Light[],
        clips: new WeakMap<Mesh, ClipMeshes>(),
        addToUpdated: (...objs: (Obj3 | Material)[]) => {
            for (const obj of objs) {
                if (obj instanceof Mesh || obj instanceof Light || obj instanceof Material) {
                    this.cachedRenderList.updated.add(obj)
                }
            }
        },
    }
    private statics = { ticks: [] as number[], frameTime: 0 }
    override render(scene: Scene, camera: Camera, opts = { } as {
        depthTexture?: Texture
        colorTexture?: Texture
        webgpu?: {
            keepFrame?: boolean
            disableBundle?: boolean
            depthStencilAttachment?: Partial<GPURenderPassDepthStencilAttachment>
        }
    }) {
        const start = performance.now()
        if (this.width * this.devicePixelRatio !== this.renderSize.width ||
            this.height * this.devicePixelRatio !== this.renderSize.height) {
            this.resize()
        }

        const { revs, list, updated, addToUpdated } = this.cachedRenderList
        list.length = 0
        updated.clear()
        camera.updateIfNecessary(revs, addToUpdated)
        // TODO: enable this
        // Obj3.update(objs)
        for (const obj of scene) {
            obj.updateIfNecessary(revs, addToUpdated)
            obj.walk(obj => (obj instanceof Mesh || obj instanceof Light) && list.push(obj))
        }

        const { opaque, translucent, lights } = this.cachedRenderList
        opaque.length = translucent.length = lights.length = 0
        for (const obj of list) {
            if (obj instanceof Mesh && obj.isVisible && obj.geo && obj.mat) {
                const { mat } = obj
                if (revs[mat.id] !== mat.rev && (revs[mat.id] = mat.rev)) {
                    addToUpdated(mat)
                }
                if (obj.mat.prop.a < 1) {
                    translucent.push(obj as any)
                } else {
                    opaque.push(obj as any)
                }
            } else if (obj instanceof Light) {
                lights.push(obj)
            }
        }

        const { pipeline } = this.cache,
            opaqueSorted = (opaque as (RenderMesh & { pipelineId: number })[])
                .map(item => ((item.pipelineId = pipeline(item.geo.type, item.mat).id), item))
                .sort((a, b) => 
                    (a.renderOrder - b.renderOrder) ||
                    (a.pipelineId - b.pipelineId) ||
                    (a.mat.renderOrder - b.mat.renderOrder) ||
                    (a.mat.id - b.mat.id) ||
                    (a.geo.id - b.geo.id)) as RenderMesh[],
            transSorted = (translucent as (RenderMesh & { cameraDist: number })[])
                .map(item => ((item.cameraDist = vec4.dist(item.center, camera.worldPosition)), item))
                .sort((a, b) => b.cameraDist - a.cameraDist) as RenderMesh[],
            sorted = [] as typeof opaqueSorted,
            clipCaps = [] as typeof opaqueSorted

        let hasClipPlane = false
        for (const item of opaqueSorted.concat(transSorted)) {
            if (item.mat.needsClip && item.geo.type === 'triangle-list') {
                hasClipPlane = true
                let clip = this.cachedRenderList.clips.get(item)
                if (!clip) {
                    const { r, g, b } = item.mat.prop,
                        stride = item.mat.opts.entry.frag === 'fragMainColor' ? 0 : 5
                    this.cachedRenderList.clips.set(item, clip = new ClipMeshes({ r, g, b }, stride))
                }
                clip.update(item)
                addToUpdated(clip.back.mat, clip.front.mat, clip.plane.mat)
                addToUpdated(clip.back, clip.front, clip.plane)
                clipCaps.push(clip.back, clip.front, clip.plane)
            }
            sorted.push(item)
        }
        sorted.unshift(...clipCaps)

        this.updateUniforms(this.buildRenderUnifroms(lights))
        this.updateUniforms(this.cache.bindings(camera))
        for (const obj of updated) {
            this.updateUniforms(this.cache.bindings(obj))
        }

        const cmd = this.device.createCommandEncoder(),
            colorTexture = opts.colorTexture ? this.cache.texture(opts.colorTexture) : this.context.getCurrentTexture(),
            depthTexture = opts.depthTexture ? this.cache.texture(opts.depthTexture) : this.cache.depthTexture,
            pass = cmd.beginRenderPass({
                colorAttachments: [{
                    ...(this.opts.sampleCount! > 1 ? {
                        view: this.cache.fragmentTexture.createView(),
                        resolveTarget: colorTexture.createView(),
                    } : {
                        view: colorTexture.createView(),
                    }),
                    loadOp: opts.webgpu?.keepFrame ? 'load' : 'clear',
                    storeOp: 'store',
                    clearValue: this.clearColor,
                }],
                depthStencilAttachment: {
                    view: depthTexture.createView(),
                    depthLoadOp: opts.webgpu?.keepFrame ? 'load' : 'clear',
                    depthClearValue: 0,
                    depthStoreOp: 'store',
                    stencilLoadOp: opts.webgpu?.keepFrame ? 'load' : 'clear',
                    stencilClearValue: 0,
                    stencilStoreOp: 'store',
                    ...opts.webgpu?.depthStencilAttachment
                }
            })

        if (hasClipPlane) {
            pass.setStencilReference(1)
        }
        if (opts.webgpu?.disableBundle) {
            this.runRenderPass(pass, sorted, camera)
        } else {
            if (this.cachedRenderPass.compare(sorted)) {
                this.cachedRenderPass.objs = sorted.map(mesh => ({ mesh, geo: mesh.geo, mat: mesh.mat, offset: mesh.offset, count: mesh.count }))
                const encoder = this.device.createRenderBundleEncoder({
                    colorFormats: [this.cache.opts.fragmentFormat],
                    depthStencilFormat: this.cache.opts.depthFormat,
                    sampleCount: this.opts.sampleCount
                })
                this.runRenderPass(encoder, sorted, camera)
                this.cachedRenderPass.bundles = [encoder.finish()]
            }
            pass.executeBundles(this.cachedRenderPass.bundles)
        }

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
