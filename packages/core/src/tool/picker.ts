import { mat4, vec3 } from "gl-matrix"

import wrap from "../utils/worker"
import Renderer from "../engine/webgpu/renderer"
import Geometry, { PlaneXY } from "../engine/geometry"
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
async function readPixel({ x, y }: { x: number, y: number }) {
    const { ctx, pixels, renderer, canvas } = await getCache(),
        image = canvas.transferToImageBitmap()
    pixels.width = image.width
    pixels.height = image.height
    ctx.drawImage(image,
        0, 0, image.width, image.height,
        0, 0, renderer.width, renderer.height)
    const { data: [r = 0, g = 0, b = 0, a = 0] } = ctx.getImageData(x, y, 1, 1)
    return { r, g, b, a }
}

export interface PickMesh {
    id: number
    rev: number
    geoId: number 
    worldMatrix: mat4
}

export interface PickGeo {
    type: GPUPrimitiveTopology
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
        async resize(width: number, height: number) {
            const { renderer } = await getCache()
            renderer.width = width
            renderer.height = height
        },
        async render(meshes: Record<number, PickMesh>,
                     geometries: Record<number, PickGeo>,
                     { fov, aspect, near, far, worldMatrix }: PickCamera,
                     { x, y }: { x: number, y: number }) {
            const { renderer, camera, pixels } = await getCache(),
                { scene, geoMap, matMap, meshMap, meshRev } = cache
            scene.clear()
            Object.assign(camera, { fov, aspect, near, far })
            camera.setWorldMatrix(worldMatrix)
            for (const { worldMatrix, geoId, id, rev } of Object.values(meshes)) {
                const item = geometries[geoId]
                if (!item) {
                    throw Error(`geometry ${geoId} is not found`)
                }
                const geo = geoMap[geoId] || (geoMap[geoId] = new Geometry(item)),
                    mat = matMap[id] || (matMap[id] = new BasicMaterial({
                        entry: { frag: 'fragMainColor' },
                        color: new Uint8Array([id, id >> 8]),
                    })),
                    key = geoId + ':' + id,
                    mesh = meshMap[key] && meshRev[key] === rev ? meshMap[key]! : (meshMap[key] = new Mesh(geo, mat))
                meshRev[key] = rev
                mesh.setWorldMatrix(worldMatrix)
                scene.add(mesh)
            }
            if (scene.size >= 0xffff) {
                throw Error(`picker support ${0xffff} meshes at max`)
            }

            const depthTexture = new Texture({
                size: { width: renderer.width, height: renderer.height, depthOrArrayLayers: 1 },
                usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
                format: 'depth24plus',
            })
            renderer.render(scene, camera, { depthTexture })
            const pixel = await readPixel({ x, y }),
                id = pixel.r === 0xff && pixel.g === 0xff ? -1 : pixel.r + (pixel.g << 8)

            const plane = new Mesh(
                new PlaneXY({ size: 1 }),
                new BasicMaterial({
                    entry: { frag: 'fragMainDepth' },
                    texture: depthTexture,
                }))
            renderer.render(new Scene([plane]), new Camera())
            const dp = await readPixel({ x, y }),
                depthVal = (dp.r + (dp.g << 8) + (dp.b << 16)) / 0xffffff,
                // https://stackoverflow.com/a/66928245
                depth = 1 / (depthVal * (1 / camera.far - 1 / camera.near) + 1 / camera.near)
            
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
        await worker.resize(opts.width, opts.height)
        const meshes = { } as Record<number, PickMesh>,
            geometries = { } as Record<number, PickGeo>
        for (const obj of scene) {
            obj.walk(obj => {
                if (obj instanceof Mesh) {
                    const { worldMatrix, geo, id, rev } = obj
                    meshes[obj.id] = { worldMatrix, id, rev, geoId: geo.id }
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
