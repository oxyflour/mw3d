import cache from "../../utils/cache"
import { BasicMaterial, Camera, Mesh, PerspectiveCamera, Scene, SpriteGeometry, Texture, Uniform, UniformValue, WebGPURenderer } from ".."
import { RenderOptions } from "../renderer"

import wgsl from './tracer.wgsl?raw'
import { BindingResource } from "../webgpu/cache"

export default class WebGPUTracer extends WebGPURenderer {
    private pipeline!: GPUComputePipeline
    protected override async init() {
        const { device } = await super.init()
        this.pipeline = device.createComputePipeline({
            layout: 'auto',
            compute: {
                module: device.createShaderModule({ code: wgsl }),
                entryPoint: 'main'
            }
        })
        return this
    }
    private cameraPropUniform = new Float32Array([1, 1])
    private binding = cache((tex: GPUTexture) => {
        const texture = new Texture({
            size: { width: tex.width, height: tex.height },
            format: 'rgba8unorm',
            usage: Texture.Usage.TEXTURE_BINDING | Texture.Usage.COPY_DST | Texture.Usage.STORAGE_BINDING,
        })
        const output = {
            uniforms: [
                texture,
                [this.cameraPropUniform]
            ],
            bindingGroup: 0,
        }
        this.fullScreenQuad.mat = new BasicMaterial({ texture })
        return output
    })
    private meshesObject = {
        uniforms: [] as Uniform[],
        bindingGroup: 2,
    }
    private fullScreenQuad = new Mesh(new SpriteGeometry({ positions: [0, 0, 0], width: 2, height: 2 }))
    private renderSetup = {
        scene: new Scene([this.fullScreenQuad]),
        camera: new Camera()
    }
    private meshesTransformBinding = {} as {
        map: Record<number, {
            value: UniformValue
            offset: number
        }>
        buffer: GPUBuffer
        offset: number
    }
    override render(scene: Scene, camera: Camera, opts = { } as RenderOptions & {
        webgpu?: {
            disableBundle?: boolean
            depthStencilAttachment?: Partial<GPURenderPassDepthStencilAttachment>
            commandEncoder?: GPUCommandEncoder
        }
    }) {
        const { sorted, updated } = this.prepare(scene, camera, { disableTransparent: true })
        if (this.cachedRenderPass.compare(sorted)) {
            this.cachedRenderPass.objs = sorted.map(mesh => ({ mesh, geo: mesh.geo, mat: mesh.mat, offset: mesh.offset, count: mesh.count }))
            const range = [] as number[],
                verts = [] as number[],
                faces = [] as number[]
            for (const mesh of sorted) {
                range.push(faces.length / 4, verts.length / 4)
                if (mesh.geo.indices) {
                    // Fxxk: https://sotrh.github.io/learn-wgpu/showcase/alignment/#alignment-of-vertex-and-index-buffers
                    for (let i = 0; i < mesh.geo.indices.length; i += 3) {
                        faces.push(...mesh.geo.indices.slice(i, i + 3), 0)
                    }
                    for (let i = 0; i < mesh.geo.positions.length; i += 3) {
                        verts.push(...mesh.geo.positions.slice(i, i + 3), 1)
                    }
                }
            }
            this.meshesObject.uniforms = [
                [new Uint32Array(range)],
                [new Float32Array(verts)],
                [new Uint32Array(faces)],
                sorted.map(mesh => mesh.worldMatrix),
            ].map(item => Object.assign(item, {
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            }))
            const bindings = this.cache.bindings(this.meshesObject)
            this.updateUniforms(bindings)
            const { uniforms = [] } = bindings[3] as BindingResource,
                { buffer, offset = 0 } = bindings[3] as GPUBufferBinding
            this.meshesTransformBinding = { buffer, offset, map: { } }
            for (const [index, item] of uniforms.entries()) {
                this.meshesTransformBinding.map[sorted[index]?.id || 0] = item
            }
        }

        if (camera instanceof PerspectiveCamera) {
            const hf = camera.fov / 2
            this.cameraPropUniform[0] =  Math.tan(hf * camera.aspect)
            this.cameraPropUniform[1] = -Math.tan(hf)
        }

        const cmd = this.device.createCommandEncoder(),
            pass = cmd.beginComputePass(),
            { pipeline, cache } = this,
            { width, height } = cache.fragmentTexture,
            output = this.binding(cache.fragmentTexture)
        pass.setPipeline(pipeline)
        pass.setBindGroup(...cache.bind(pipeline, output))
        pass.setBindGroup(...cache.bind(pipeline, camera))
        pass.setBindGroup(...cache.bind(pipeline, this.meshesObject))
        this.updateUniforms(cache.bindings(output))
        this.updateUniforms(cache.bindings(camera))
        {
            const { buffer, offset, map } = this.meshesTransformBinding,
                uniforms = Array.from(updated).map(item => map[item.id]!).filter(item => item)
            this.updateUniforms([{ buffer, offset, uniforms }])
        }
        pass.dispatchWorkgroups(width, height)
        pass.end()
        if (opts.webgpu?.commandEncoder) {
            throw Error(`should not use opts.webgpu.commandEncoder with tracer`)
        } else {
            const { scene, camera } = this.renderSetup,
                webgpu = opts.webgpu || (opts.webgpu = { })
            webgpu.commandEncoder = cmd
            webgpu.disableBundle = true
            super.render(scene, camera, opts)
        }
    }
}
