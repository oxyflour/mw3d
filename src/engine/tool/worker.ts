import { mat4, vec3 } from "gl-matrix"

import wrap from "../../utils/worker"
import Renderer from "../webgpu/renderer"
import Obj3, { Scene } from "../obj3"
import Geometry from "../geometry"
import Mesh from "../mesh"
import Material, { BasicMaterial } from "../material"
import { PerspectiveCamera } from "../camera"

let cache: ReturnType<typeof init>
async function init(canvas: OffscreenCanvas, pixels: OffscreenCanvas, opts?: Renderer['opts']) {
    const renderer = await Renderer.create(canvas, opts),
        camera = new PerspectiveCamera(45, 1, 1, 100),
        transfer = pixels as HTMLCanvasElement
    return { renderer, camera, canvas, transfer }
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

const scene = new Scene(),
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
            renderer.render(scene, camera)
            const ctx = transfer.getContext('2d'),
                image = (canvas as any).transferToImageBitmap() as ImageBitmap
            transfer.width = image.width
            transfer.height = image.height
            ctx.drawImage(image,
                0, 0, image.width, image.height,
                0, 0, renderer.width, renderer.height)
            const { data: [r, g, b, a] } = ctx.getImageData(x, y, 1, 1),
                val = r + (g << 8),
                id = val === 0xffff ? -1 : val,
                distance = (b + (a << 8)) / 0x100 * (camera.far - camera.near) + camera.near,
                blob = await (transfer as any).convertToBlob() as Blob,
                buffer = await blob.arrayBuffer()
            return { id, buffer, distance }
        }
    }
})
