import { mat4 } from "gl-matrix"

import wrap from "../../utils/worker"
import Renderer from "../webgpu/renderer"
import Geometry, { PlaneXY } from "../geometry"
import Mesh from "../mesh"
import Material, { BasicMaterial } from "../material"
import Obj3, { Scene } from "../obj3"
import Camera, { PerspectiveCamera } from "../camera"
import { Texture } from "../uniform"

interface WebGPUOffscreenCanvas extends
        Omit<OffscreenCanvas, 'getContext'>,
        Omit<HTMLCanvasElement, 'getContext'> {
    transferToImageBitmap(): ImageBitmap
    convertToBlob(): Promise<Blob>
    getContext(context: '2d'): CanvasRenderingContext2D
    getContext(context: 'webgpu'): GPUCanvasContext
}

const cache = {
    inited: undefined as ReturnType<typeof initCache>,
    scene: new Scene(),
    // TODO: LRU
    geoMap: { } as Record<number, Geometry>,
    matMap: { } as Record<number, Material>,
    meshMap: { } as Record<string, Mesh>,
}
async function initCache(canvas: WebGPUOffscreenCanvas, pixels: WebGPUOffscreenCanvas, opts?: Renderer['opts']) {
    const renderer = await Renderer.create(canvas, opts),
        camera = new PerspectiveCamera(45, 1, 1, 100),
        ctx = pixels.getContext('2d')
    return { renderer, camera, canvas, pixels, ctx }
}
async function readPixel({ x, y }: { x: number, y: number }) {
    const { ctx, pixels, renderer, canvas } = await cache.inited,
        image = canvas.transferToImageBitmap()
    pixels.width = image.width
    pixels.height = image.height
    ctx.drawImage(image,
        0, 0, image.width, image.height,
        0, 0, renderer.width, renderer.height)
    const { data: [r, g, b, a] } = ctx.getImageData(x, y, 1, 1)
    return { r, g, b, a }
}

export interface PickMesh {
    id: number
    geoId: number 
    worldMatrix: mat4
}

export interface PickGeo {
    type: GPUPrimitiveTopology
    positions: Float32Array
    normals?: Float32Array
    indices?: Uint16Array | Uint32Array
}

const worker = wrap({
    num: 1,
    // @ts-ignore
    fork: () => new Worker(new URL('./picker.ts', import.meta.url), { type: 'module' }),
    send: async (args, next) => {
        const transfer = args.filter(arg => arg?.constructor?.name === 'OffscreenCanvas')
        return await next(args, transfer)
    },
    api: {
        async init(canvas: WebGPUOffscreenCanvas, pixels: WebGPUOffscreenCanvas, opts?: Renderer['opts']) {
            await cache.inited || (cache.inited = initCache(canvas, pixels, opts))
        },
        async resize(width: number, height: number) {
            const { renderer } = await cache.inited
            renderer.width = width
            renderer.height = height
        },
        async render(meshes: Record<number, PickMesh>,
                     geometries: Record<number, PickGeo>,
                     { fov, aspect, near, far, worldMatrix }: PerspectiveCamera,
                     { x, y }: { x: number, y: number }) {
            const { renderer, camera, pixels } = await cache.inited,
                { scene, geoMap, matMap, meshMap } = cache
            scene.clear()
            Object.assign(camera, { fov, aspect, near, far })
            camera.setWorldMatrix(worldMatrix)
            for (const { worldMatrix, geoId, id } of Object.values(meshes)) {
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
                    mesh = meshMap[key] || (meshMap[key] = new Mesh(geo, mat))
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
                depth = (dp.r + (dp.g << 8) + (dp.b << 16)) / 0xffffff,
                // https://stackoverflow.com/a/66928245
                distance = 1 / (depth * (1 / camera.far - 1 / camera.near) + 1 / camera.near)

            const blob = await pixels.convertToBlob() as Blob,
                buffer = await blob.arrayBuffer()
            return { id, buffer, distance }
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
                    const { worldMatrix, geo, id } = obj
                    meshes[obj.id] = { worldMatrix, id, geoId: geo.id }
                    const { type, positions, normals, indices } = geo
                    geometries[geo.id] = { type, positions, normals, indices }
                }
            })
        }
        return await worker.render(meshes, geometries, camera, opts)
    }

    private static inited: Promise<void>
    private static async init() {
        const offscreen = document.createElement('canvas') as any,
            pixels = document.createElement('canvas') as any
        await worker.init(
            offscreen.transferControlToOffscreen() as WebGPUOffscreenCanvas,
            pixels.transferControlToOffscreen() as WebGPUOffscreenCanvas)
    }
    static async create(opts?: {
        size?: { width: number, height: number }
    }) {
        await (this.inited || (this.inited = this.init()))
        return new Picker()
    }
}
