import 'webrtx'

import cache from "../../utils/cache"
import { BasicMaterial, Camera, Mesh, PerspectiveCamera, Scene, SphereGeometry, SpriteGeometry, WebGPURenderer } from ".."
import { RendererOptions, RenderMesh, RenderOptions } from "../renderer"

import raygenGlsl from './raygen.glsl?raw'
import raymissGlsl from './raymiss.glsl?raw'
// @ts-ignore
import sphereRint from './sphere.rint?raw'
import SceneLoader, { LoadedSceneResult, ScalarShaderRecord, SceneDescription, ShaderRecord, writeShaderRecords } from './loader'
import { mat4 } from 'gl-matrix'

const loader = new SceneLoader()
const quadFrag = `
fn main(@builtin(position) coord : vec4<f32>) -> @location(0) vec4<f32> {
    preventLayoutChange();
    let INV_GAMMA = vec3<f32>(1.0 / 2.2, 1.0 / 2.2, 1.0 / 2.2);
    let pixelIndex = u32(coord.x) + u32(coord.y) * u32(canvasSize.x / 8.) * 8;
    let pixelColor = pixelBuffer.pixels[pixelIndex];
    let w = mix(0., 1. / pixelColor.w, f32(pixelColor.w > 0.0));
    return vec4<f32>(pow((w * pixelColor).xyz, INV_GAMMA), 1.0);
}`

export default class WebRTXRenderer extends WebGPURenderer {
    constructor(canvas: HTMLCanvasElement | OffscreenCanvas, override readonly opts: RendererOptions & {
        webgpu?: {
            adaptorOptions?: GPURequestAdapterOptions
            deviceDescriptor?: GPUDeviceDescriptor
            canvasConfig?: GPUCanvasConfiguration
        }
        webrtx?: SceneDescription
    }) {
        const webgpu = opts.webgpu || (opts.webgpu = { }),
            deviceDescriptor = webgpu.deviceDescriptor || (webgpu.deviceDescriptor = { })
        deviceDescriptor.requiredFeatures = ["ray_tracing" as GPUFeatureName]
        super(canvas, opts)
    }
    private binding = cache((tex: GPUTexture) => {
        const output = {
            uniforms: [
                Object.assign(
                    [new Float32Array(tex.width * tex.height * 4)],
                    { usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }),
            ],
            bindingGroup: 0,
        }
        const mat = this.fullScreenQuad.mat = new BasicMaterial({ wgsl: { frag: quadFrag } }),
            [resource] = this.cache.bindings(output)
        if (resource) {
            mat.uniforms[1] = resource
        }
        return output
    })
    private fullScreenQuad = new Mesh(new SpriteGeometry({ positions: [0, 0, 0], width: 2, height: 2 }))
    private renderSetup = {
        scene: new Scene([this.fullScreenQuad]),
        camera: new Camera()
    }
    private rtxScene = { } as Partial<LoadedSceneResult> & {
        updateRayGen?: (camera: Camera, fov: number) => void
        bindGroup?: GPUBindGroup
    }
    private async load(sorted: RenderMesh[], camera: Camera) {
        const rayGenRowMajorMatrix = mat4.create(),
            rayGenFov = {
                "type": "float", // vfov radians
                "data": 0.343 //  39.3077'
            } as ScalarShaderRecord,
            rayGenShaderRecords = [{
                "type": "mat4",
                "data": [{ // initial_transform_to_world
                    rowMajorMatrix: mat4.transpose(rayGenRowMajorMatrix, camera.worldMatrix),
                }]
            }, rayGenFov] as ShaderRecord[]
        const scene = {
            rayGen: {
                shader: raygenGlsl,
                shaderRecord: rayGenShaderRecords
            },
            rayMiss: raymissGlsl,
            rayTypes: 2,
            materials: { },
            blas: {
                "unit-sphere": {
                    "geometries": [{
                        "type": "aabb",
                        "intersection": sphereRint,
                        "aabb": [
                            [-1, -1, -1],
                            [1, 1, 1]
                        ]
                    }]
                }
            },
            tlas: [ ],
            version: '',
            ...this.opts.webrtx
        } as SceneDescription
        for (const { mat, geo, worldPosition, scaling } of sorted) {
            if (mat.opts.webrtx) {
                scene.materials[mat.id] = mat.opts.webrtx
            }
            if (geo instanceof SphereGeometry) {
                scene.tlas.push({
                    blas: 'unit-sphere',
                    material: `${mat.id}`,
                    // FIXME: It says "transform is not affine" using world matrix
                    transformToWorld: [{
                        translate: worldPosition.slice(0, 3) as any,
                    }, {
                        scale: scaling.data.slice(0, 3) as any
                    }]
                })
            } else {
                scene.blas[geo.id] = {
                    geometries: [{
                        type: 'triangles',
                        vertices: geo.positions,
                        index: geo.indices instanceof Uint16Array ? new Uint32Array(geo.indices) : geo.indices
                    }],
                }
                scene.tlas.push({
                    blas: `${geo.id}`,
                    material: `${mat.id}`
                })
            }
        }
        const binding = this.binding(this.cache.fragmentTexture),
            [resource] = this.cache.bindings(binding),
            { pipeline, tlas, userBindGroupEntries, sbt } = this.rtxScene = await loader.load(this.device, scene)
        this.rtxScene.bindGroup = this.device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{
                binding: 0,
                resource: tlas as any,
            }, {
                binding: 1,
                resource,
            }].concat(userBindGroupEntries),
        })
        const buf = new Float32Array(16 + 1),
            view = new DataView(buf.buffer)
        this.rtxScene.updateRayGen = (camera, fov) => {
            mat4.transpose(rayGenRowMajorMatrix, camera.worldMatrix)
            rayGenFov.data = fov
            writeShaderRecords(view, rayGenShaderRecords, 0)
            this.device.queue.writeBuffer(sbt.buffer, this.device.ShaderGroupHandleSize + sbt.rayGen.start, buf)
        }
    }
    override render(scene: Scene, camera: Camera, opts = { } as RenderOptions) {
        const { sorted } = this.prepare(scene, camera, { disableTransparent: true })
        if (this.cachedRenderPass.compare(sorted)) {
            this.cachedRenderPass.objs = sorted.map(mesh => ({ mesh, geo: mesh.geo, mat: mesh.mat, offset: mesh.offset, count: mesh.count }))
            this.load(sorted, camera)
        }

        const cmd = this.device.createCommandEncoder(),
            pass = cmd.beginRayTracingPass(),
            { sbt, pipeline, bindGroup } = this.rtxScene
        if (sbt && bindGroup && pipeline) {
            pass.setPipeline(pipeline)
            pass.setBindGroup(0, bindGroup)
            camera.updateIfNecessary({ })
            const fov = camera instanceof PerspectiveCamera ? camera.fov / 2 : 0.5
            this.rtxScene.updateRayGen?.(camera, fov)
            // Note: it requires rounded by 8
            const { width, height } = this.renderSize,
                [w = 1, h = 1] = [width, height].map(val => Math.floor(val / 8) * 8)
            pass.traceRays(this.device, sbt, w, h)
        }
        pass.end()
        {
            const webgpu = { commandEncoder: cmd, disableBundle: true },
                { scene, camera } = this.renderSetup
            super.render(scene, camera, { ...opts, webgpu })
        }
    }
}
