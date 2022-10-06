import { mat4, vec3, vec4 } from "gl-matrix"

import wrap from "../utils/worker"
import Renderer from "../engine/webgpu/renderer"
import Geometry, { GeometryPrimitive, PlaneXY } from "../engine/geometry"
import Material, { BasicMaterial } from "../engine/material"
import Obj3, { Scene } from "../engine/obj3"
import Camera, { PerspectiveCamera } from "../engine/camera"
import { Mesh } from '../engine'
import { Texture } from "../engine/uniform"

import WorkerSelf from './picker?worker&inline'

interface WebGPUOffscreenCanvas extends
        Omit<OffscreenCanvas, 'getContext'>,
        Omit<HTMLCanvasElement, 'getContext'> {
    transferToImageBitmap(): ImageBitmap
    convertToBlob(): Promise<Blob>
    getContext(context: '2d'): CanvasRenderingContext2D
    getContext(context: 'webgpu'): GPUCanvasContext
}

const cache = {
    created: undefined as undefined | ReturnType<typeof initCache>,
    scene: new Scene(),
    // TODO: LRU
    geoMap: { } as Record<number, Geometry>,
    matMap: { } as Record<number, Material>,
    meshMap: { } as Record<string, Mesh>,
    meshRev: { } as Record<string, number>,
}
async function initCache(canvas: WebGPUOffscreenCanvas, pixels: WebGPUOffscreenCanvas, opts?: Renderer['opts']) {
    const renderer = await Renderer.create(canvas, opts),
        camera = new PerspectiveCamera(),
        ctx = pixels.getContext('2d')
    return { renderer, camera, canvas, pixels, ctx }
}
async function getCache() {
    const ret = await cache.created
    if (!ret) {
        throw Error(`not started`)
    }
    return ret
}
async function readPixel({ x, y, w = 1, h = 1 }: { x: number, y: number, w?: number, h?: number }) {
    const { ctx, pixels, renderer, canvas } = await getCache(),
        image = canvas.transferToImageBitmap()
    pixels.width = image.width
    pixels.height = image.height
    ctx.drawImage(image,
        0, 0, image.width, image.height,
        0, 0, renderer.width, renderer.height)
    const { data } = ctx.getImageData(x, y, w, h),
        ret = new Set<number>()
    for (let i = 0; i < data.length; i += 4) {
        const [r = 0xff, g = 0xff, b = 0xff] = [data[i], data[i + 1], data[i + 2]]
        if (r !== 0xff || g !== 0xff || b !== 0xff) {
            ret.add(r + (g << 8) + (b << 16))
        }
    }
    return Array.from(ret)
}

export interface PickMesh {
    id: number
    rev: number
    geoId: number 
    worldMatrix: mat4
    clipPlane: vec4
}

export interface PickGeo {
    type: GeometryPrimitive
    positions: Float32Array
    normals?: Float32Array
    indices?: Uint16Array | Uint32Array
}

export interface PickCamera {
    fov: number
    aspect: number
    near: number
    far: number
    worldMatrix: mat4
}

const textureCache = {
    width: 0,
    height: 0,
    texture: undefined as undefined | Texture
}

let renderLock = 0
const worker = wrap({
    num: 1,
    // @ts-ignore
    fork: () => new (WorkerSelf as any)(),
    send: async (args, next) => {
        const transfer = args.filter(arg => arg?.constructor?.name === 'OffscreenCanvas')
        return await next(args, transfer)
    },
    api: {
        async init(canvas: WebGPUOffscreenCanvas, pixels: WebGPUOffscreenCanvas, opts?: Renderer['opts']) {
            await cache.created || (cache.created = initCache(canvas, pixels, opts))
        },
        async render(meshes: Record<number, PickMesh>,
                     geometries: Record<number, PickGeo>,
                     { fov, aspect, near, far, worldMatrix }: PickCamera,
                     { width, height, x, y }: { x: number, y: number, width: number, height: number }) {
            while (renderLock > Date.now() - 5000) {
                await new Promise(resolve => setTimeout(resolve, 10))
            }
            renderLock = Date.now()

            const { renderer, camera, pixels } = await getCache(),
                { scene, geoMap, matMap, meshMap, meshRev } = cache
            renderer.width = width
            renderer.height = height

            scene.clear()
            Object.assign(camera, { fov, aspect, near, far })
            camera.setWorldMatrix(worldMatrix)
            for (const { worldMatrix, geoId, id, rev, clipPlane } of Object.values(meshes)) {
                const item = geometries[geoId]
                if (!item) {
                    throw Error(`geometry ${geoId} is not found`)
                }
                const geo = geoMap[geoId] || (geoMap[geoId] = new Geometry(item)),
                    mat = matMap[id] || (matMap[id] = new BasicMaterial({
                        entry: { frag: 'fragMainColor' },
                        color: new Uint8Array([id, id >> 8, 0]),
                    })),
                    mesh = meshMap[id] && meshRev[id] === rev ? meshMap[id]! : (meshMap[id] = new Mesh(geo, mat))
                meshRev[id] = rev
                if (clipPlane) {
                    vec4.copy(mat.clipPlane, clipPlane)
                }
                mesh.geo = geo
                mesh.mat = mat
                mesh.setWorldMatrix(worldMatrix)
                scene.add(mesh)
            }
            if (scene.size >= 0xffff) {
                throw Error(`picker support ${0xffff} meshes at max`)
            }

            const depthTexture = (textureCache.width === width && textureCache.height === height ?
                textureCache : Object.assign(textureCache, {
                    width, height,
                    texture: new Texture({
                        size: { width: renderer.width, height: renderer.height, depthOrArrayLayers: 1 },
                        usage: Texture.Usage.RENDER_ATTACHMENT | Texture.Usage.TEXTURE_BINDING,
                        format: 'depth24plus-stencil8',
                    }, {
                        aspect: 'depth-only'
                    })
                })).texture!
            renderer.render(scene, camera, { depthTexture })
            const [id = 0] = await readPixel({ x, y }),
                plane = new Mesh(
                    new PlaneXY({ size: 1 }),
                    new BasicMaterial({
                        entry: { frag: 'fragMainDepth' },
                        texture: depthTexture,
                    }))
            renderer.render(new Scene([plane]), new Camera())
            const [val = 0] = await readPixel({ x, y }),
                d = val / 0xffffff,
                // convert from webgpu range (0, 1) to opengl range(-1, 1)
                v = d * 2 - 1,
                // https://stackoverflow.com/a/66928245
                depth = 1 / (v * (1 / camera.near - 1 / camera.far) + 1 / camera.far)
            
            const [hw, hh, hf] = [renderer.width / 2, renderer.height / 2, camera.fov / 2],
                position = vec3.fromValues(
                    Math.tan(hf * aspect) * (x - hw) / hw,
                    Math.tan(hf) * (y - hh) / -hh,
                    -1),
                distance = depth * vec3.len(position)
            vec3.normalize(position, position)
            vec3.scale(position, position, distance)
            vec3.transformMat4(position, position, camera.worldMatrix)

            const blob = await pixels.convertToBlob(),
                buffer = await blob.arrayBuffer()
            renderLock = 0
            return { id, buffer, distance, position }
        }
    }
})

export default class Picker {
    private constructor() {
    }
    async pick(scene: Set<Obj3>, camera: PerspectiveCamera, opts: {
        width: number
        height: number
        x: number
        y: number
    }) {
        const meshes = { } as Record<number, PickMesh>,
            geometries = { } as Record<number, PickGeo>
        for (const obj of scene) {
            obj.walk(obj => {
                if (obj instanceof Mesh && obj.geo && obj.mat) {
                    const { worldMatrix, geo, id, rev, mat } = obj
                    meshes[obj.id] = { worldMatrix, id, rev, clipPlane: mat.clipPlane, geoId: geo.id }
                    const { type, positions, normals, indices } = geo
                    geometries[geo.id] = { type, positions, normals, indices }
                }
            })
        }
        const { fov, aspect, near, far, worldMatrix } = camera,
            view = { fov, aspect, near, far, worldMatrix }
        return await worker.render(meshes, geometries, view, opts)
    }

    private static created: Promise<Picker>
    private static async create() {
        const offscreen = document.createElement('canvas') as any,
            pixels = document.createElement('canvas') as any
        await worker.init(
            offscreen.transferControlToOffscreen() as WebGPUOffscreenCanvas,
            pixels.transferControlToOffscreen() as WebGPUOffscreenCanvas)
        return new Picker()
    }
    static async init() {
        return await (this.created || (this.created = this.create()))
    }
}
