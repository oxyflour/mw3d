import 'webrtx'

import cache from "../../utils/cache"
import { BasicMaterial, Camera, Mesh, PerspectiveCamera, Scene, SphereGeometry, SpriteGeometry, WebGPURenderer } from ".."
import { RendererOptions, RenderMesh, RenderOptions } from "../renderer"

import raygenGlsl   from './shaders/raygen.glsl?raw'
import raymissGlsl  from './shaders/raymiss.glsl?raw'
import diffuseRchit from './shaders/diffuse.rchit?raw'
import shadowRahit  from './shaders/shadow.rahit?raw'
import mirrorRchit  from './shaders/mirror.rchit?raw'
import glassRchit   from './shaders/glass.rchit?raw'
import sphereRint   from './shaders/sphere.rint?raw'

import SceneLoader, { LoadedSceneResult, SceneDescription, ShaderRecord, writeShaderRecords } from './loader'
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
    public static Builtin = {
        diffuse: ({
            albedo = [0, 0, 0] as [number, number, number],
            light = [0, 0, 0, 0] as [number, number, number, number],
        } = { }) => [ /* radiance ray */ {
            rchit: diffuseRchit,
            shaderRecord: [{
                type: 'vec4' as 'vec4',
                data: light /* vec3(light radiance), float(inv_area) */
            }, {
                type: 'vec3' as 'vec3',
                data: albedo /* albedo */
            }]
        }, /* shadow ray */ {
            rahit: shadowRahit
        }],
        mirror: ({
            reflection = [0.65, 0.65, 0.65] as [number, number, number],
        } = { }) => [ /* radiance ray */ {
            rchit: mirrorRchit,
            shaderRecord: [{
                type: 'vec3' as 'vec3', // KR
                data: reflection
            }]
        }, /* shadow ray */ {
            rahit: shadowRahit
        }],
        glass: ({
            reflection = [0.65, 0.65, 0.65],
            transmission = [0.65, 0.65, 0.65],
        } = { }) => [ /* radiance ray */ {
            rchit: glassRchit,
            shaderRecord: [{
                type: 'vec3' as 'vec3', // KR
                data: reflection
            }, {
                type: 'vec3' as 'vec3', // KT
                data: transmission
            }, {
                type: 'vec2' as 'vec2',
                data: [1.0, 1.5] // etai, etat
            }]
        }, /* shadow ray */ {
            rahit: shadowRahit
        }]
    }
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
            rayGenFov = { type: 'float', data: 0.343 },
            rayGenReset = { type: 'float', data: 0 },
            rayGenShaderRecords = [{
                type: 'mat4',
                data: { rowMajorMatrix: mat4.transpose(rayGenRowMajorMatrix, camera.worldMatrix) }
            }, rayGenFov, rayGenReset] as ShaderRecord[]
        const scene = {
            rayGen: {
                shader: raygenGlsl,
                shaderRecord: rayGenShaderRecords
            },
            rayMiss: raymissGlsl,
            rayTypes: 2,
            materials: { },
            blas: {
                'unit-sphere': {
                    geometries: [{
                        type: 'aabb',
                        intersection: sphereRint,
                        aabb: [
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
        for (const { mat, geo, worldMatrix } of sorted) {
            const { r, g, b, emissive } = mat.prop
            scene.materials[mat.id] = mat.opts.webrtx || (mat.prop.a !== 1 ?
                WebRTXRenderer.Builtin.glass() :
                WebRTXRenderer.Builtin.diffuse({
                    albedo: [r, g, b],
                    light: emissive ? [emissive, emissive, emissive, 7.33e-5] : [0, 0, 0, 0]
                }))
            const rowMajorMatrix = mat4.transpose(mat4.create(), worldMatrix)
            if (geo instanceof SphereGeometry) {
                scene.tlas.push({
                    blas: 'unit-sphere',
                    material: `${mat.id}`,
                    transformToWorld: { rowMajorMatrix }
                })
            } else {
                scene.blas[geo.id] = {
                    geometries: [{
                        type: 'triangles',
                        vertices: geo.positions,
                        index: geo.indices
                    }],
                }
                scene.tlas.push({
                    blas: `${geo.id}`,
                    material: `${mat.id}`,
                    transformToWorld: { rowMajorMatrix }
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
        const buf = new Float32Array(16 + 1 + 1),
            view = new DataView(buf.buffer),
            cameraWorldMatrix = mat4.create()
        this.rtxScene.updateRayGen = (camera, fov) => {
            mat4.transpose(rayGenRowMajorMatrix, camera.worldMatrix)
            rayGenFov.data = fov
            if (rayGenReset.data = mat4.equals(cameraWorldMatrix, camera.worldMatrix) ? 0 : 1) {
                mat4.copy(cameraWorldMatrix, camera.worldMatrix)
            }
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
            this.rtxScene.updateRayGen?.(camera, camera instanceof PerspectiveCamera ? camera.fov / 2 : 0.5)
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
