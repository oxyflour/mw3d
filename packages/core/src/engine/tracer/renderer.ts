import cache from "../../utils/cache"
import { BasicMaterial, Camera, Light, Material, Mesh, Scene, SpriteGeometry, Texture, WebGPURenderer } from ".."
import { RendererOptions, RenderOptions } from "../renderer"

import wgsl from './tracer.wgsl?raw'

export default class WebGPUTracer extends WebGPURenderer {
    updateBVH(updated: Set<Mesh | Light | Material>) {
        updated
        return null
    }
    pipeline = cache((device: GPUDevice) => device.createComputePipeline({
        layout: 'auto',
        compute: {
            module: device.createShaderModule({ code: wgsl }),
            entryPoint: 'main'
        }
    }))
    binding = cache((tex: GPUTexture) => {
        const texture = new Texture({
            size: { width: tex.width, height: tex.height },
            format: 'rgba8unorm',
            usage: Texture.Usage.TEXTURE_BINDING | Texture.Usage.COPY_DST | Texture.Usage.STORAGE_BINDING,
        })
        const object = {
            uniforms: [texture],
            bindingGroup: 0,
        }
        const material = new BasicMaterial({ texture })
        return { object, material }
    })
    private fullScreenQuad = new Mesh(new SpriteGeometry({ positions: [0, 0, 0], width: 2, height: 2 }))
    private renderSetup = {
        scene: new Scene([this.fullScreenQuad]),
        camera: new Camera()
    }
    static override async create(canvas: HTMLCanvasElement | OffscreenCanvas, opts = { } as RendererOptions) {
        return await new WebGPUTracer(canvas, opts).init()
    }
    override render(scene: Scene, camera: Camera, opts = { } as RenderOptions & {
        webgpu?: {
            disableBundle?: boolean
            depthStencilAttachment?: Partial<GPURenderPassDepthStencilAttachment>
            commandEncoder?: GPUCommandEncoder
        }
    }) {
        scene
        camera
        /*
        const { lights, updated, sorted } = this.prepare(scene, camera),
            bvh = this.updateBVH(updated)
        lights
        sorted
        bvh
         */

        const cmd = this.device.createCommandEncoder(),
            pass = cmd.beginComputePass(),
            pipeline = this.pipeline(this.device),
            { width, height } = this.cache.fragmentTexture,
            { object, material } = this.binding(this.cache.fragmentTexture)
        this.fullScreenQuad.mat = material
        pass.setPipeline(pipeline)
        pass.setBindGroup(...this.cache.bind(pipeline, object))
        pass.dispatchWorkgroups(width, height)
        pass.end()
        if (opts.webgpu?.commandEncoder) {
            throw Error(`should not use opts.webgpu.commandEncoder with tracer`)
        } else {
            const { scene, camera } = this.renderSetup
            opts.webgpu = { ...opts.webgpu, commandEncoder: cmd }
            super.render(scene, camera, opts)
        }
    }
}
