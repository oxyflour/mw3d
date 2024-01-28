import Camera from "../camera"
import Material from "../material"
import Mesh from '../mesh'
import Light from '../light'
import { Scene } from "../obj3"

import Cache, { BindingResource } from './cache'
import Geometry from "../geometry"
import { Sampler, Texture, UniformValue } from "../uniform"
import { ClipMeshes } from "./clip"
import Renderer, { RendererOptions, RenderMesh, RenderOptions } from "../renderer"

const MAX_LIGHTS = 4

export default class WebGPURenderer extends Renderer {
    protected constructor(
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
    protected cache!: Cache
    protected device!: GPUDevice
    protected format!: GPUTextureFormat
    protected context!: GPUCanvasContext
    protected async init() {
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
            format: this.format,
            device: this.device,
            alphaMode: 'premultiplied',
        })

        return this
    }
    static async create(canvas: HTMLCanvasElement | OffscreenCanvas, opts = { } as RendererOptions) {
        return await new this(canvas, opts).init()
    }

    override resize() {
        super.resize()
        this.cache.resize(this.renderSize)
        this.context.configure({
            format: this.format,
            device: this.device,
            alphaMode: 'premultiplied',
        })
    }

    protected updateUniforms(bindings: BindingResource[]) {
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

    protected cachedRenderPass = {
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
            const count = mesh.count > 0 ? mesh.count : (mesh.geo.count - mesh.offset)
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

    readonly clipCache = new WeakMap<Mesh, ClipMeshes>()
    prepareClips(scene: Scene, camera: Camera) {
        const { lights, updated, sorted: meshes } = super.prepare(scene, camera),
            sorted = [] as typeof meshes
        for (const item of meshes) {
            if (item.mat.needsClip && item.geo.type === 'triangle-list') {
                let clip = this.clipCache.get(item)
                if (!clip) {
                    this.clipCache.set(item, clip = new ClipMeshes())
                }
                clip.update(item)
                this.addToUpdated(clip.back.mat, clip.front.mat, clip.plane.mat)
                this.addToUpdated(clip.back, clip.front, clip.plane)
                sorted.push(clip.back, clip.front, clip.plane)
            }
        }
        return { lights, updated, sorted }
    }

    override getOrderFor(mesh: RenderMesh) {
        return this.cache.pipeline(mesh.geo.type, mesh.mat).id
    }
    override render(scene: Scene, camera: Camera, opts = { } as RenderOptions & {
        webgpu?: {
            disableBundle?: boolean
            depthStencilAttachment?: Partial<GPURenderPassDepthStencilAttachment>
            commandEncoder?: GPUCommandEncoder
        }
    }) {
        super.render(scene, camera, opts)

        const { lights, updated, sorted } = opts.renderClips ?
            this.prepareClips(scene, camera) :
            this.prepare(scene, camera)
        this.updateUniforms(this.buildRenderUnifroms(lights))
        this.updateUniforms(this.cache.bindings(camera))
        for (const obj of updated) {
            this.updateUniforms(this.cache.bindings(obj))
        }

        const cmd = opts.webgpu?.commandEncoder || this.device.createCommandEncoder(),
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
                    loadOp: opts.keepFrame ? 'load' : 'clear',
                    storeOp: 'store',
                    clearValue: this.clearColor,
                }],
                depthStencilAttachment: {
                    view: depthTexture.createView(),
                    depthLoadOp: opts.keepFrame ? 'load' : 'clear',
                    depthClearValue: 0,
                    depthStoreOp: 'store',
                    stencilLoadOp: opts.keepFrame ? 'load' : 'clear',
                    stencilClearValue: 0,
                    stencilStoreOp: 'store',
                    ...opts.webgpu?.depthStencilAttachment
                }
            })

        pass.setStencilReference(1)
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
    }
}
