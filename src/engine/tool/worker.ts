import { mat4, vec3 } from "gl-matrix"

import wrap from "../../utils/worker"
import Renderer from "../webgpu/renderer"
import Obj3 from "../obj3"
import Geometry from "../geometry"
import Mesh from "../mesh"
import Material, { BasicMaterial } from "../material"
import { PerspectiveCamera } from "../camera"
import { DirectionalLight } from "../light"

let cache: ReturnType<typeof init>
async function init(canvas: OffscreenCanvas, pixels: OffscreenCanvas, opts?: Renderer['opts']) {
    const renderer = await Renderer.create(canvas, opts),
        camera = new PerspectiveCamera(45, 1, 1, 100),
        light = new DirectionalLight({ direction: [0, 0, 1], intensity: 1 }),
        transfer = pixels as HTMLCanvasElement
    return { renderer, camera, light, canvas, transfer }
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

const scene = new Set<Obj3>(),
    // TODO: LRU
    geoMap = { } as Record<number, Geometry>,
    matMap = { } as Record<number, Material>,
    meshMap = { } as Record<string, Mesh>

export default wrap({
    num: 1,
    // @ts-ignore
    fork: () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    send: async (args, next) => {
        const transfer = args.filter(arg => arg?.constructor?.name === 'OffscreenCanvas')
        return await next(args, transfer)
    },
    api: {
        async init(canvas: OffscreenCanvas, transfer: OffscreenCanvas, opts?: Renderer['opts']) {
            await (cache || (cache = init(canvas, transfer, opts)))
        },
        async resize(width: number, height: number) {
            const { renderer } = await cache
            renderer.width = width
            renderer.height = height
        },
        async render(meshes: Record<number, PickMesh>,
                     geometries: Record<number, PickGeo>,
                     { fov, aspect, near, far, worldMatrix }: PerspectiveCamera,
                     { x, y }: { x: number, y: number }) {
            scene.clear()
            const { renderer, camera, canvas, transfer } = await cache
            Object.assign(camera, { fov, aspect, near, far })
            camera.setWorldMatrix(worldMatrix)
            for (const { worldMatrix, geoId, id } of Object.values(meshes)) {
                const item = geometries[geoId]
                if (!item) {
                    throw Error(`geometry ${geoId} is not found`)
                }
                const geo = geoMap[geoId] || (geoMap[geoId] = new Geometry(item)),
                    mat = matMap[id] || (matMap[id] = new BasicMaterial({
                        color: new Uint8Array([id, id >> 8, id >> 16]),
                    })),
                    key = geoId + ':' + id,
                    mesh = meshMap[key] || (meshMap[key] = new Mesh(geo, mat))
                mesh.setWorldMatrix(worldMatrix)
                scene.add(mesh)
            }
            renderer.render(scene, camera)
            const ctx = transfer.getContext('2d'),
                image = (canvas as any).transferToImageBitmap() as ImageBitmap
            transfer.width = image.width
            transfer.height = image.height
            ctx.drawImage(image,
                0, 0, image.width, image.height,
                0, 0, renderer.width, renderer.height)
            const { data: [r, g, b] } = ctx.getImageData(x, y, 1, 1),
                id = r + (g << 8) + (b << 16),
                blob = await (transfer as any).convertToBlob() as Blob,
                buffer = await blob.arrayBuffer()
            return { buffer, id }
        }
    }
})