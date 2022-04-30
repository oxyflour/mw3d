import { mat4 } from "gl-matrix"

import wrap from "../../utils/worker"
import Renderer from "../webgpu/renderer"
import Obj3 from "../obj3"
import Geometry from "../geometry"
import Mesh from "../mesh"
import { BasicMaterial } from "../material"
import { PerspectiveCamera } from "../camera"
import { DirectionalLight } from "../light"
import { GlTf } from "gltf-loader-ts/lib/gltf"
import gltf from "../../utils/gltf"

let cache: ReturnType<typeof init>
async function init(canvas: OffscreenCanvas, opts?: Renderer['opts']) {
    const renderer = await Renderer.create(canvas, opts),
        camera = new PerspectiveCamera(45, 1, 1, 100),
        light = new DirectionalLight({ direction: [0, 0, 1], intensity: 1 })
    return { renderer, camera, light, canvas }
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

export default wrap({
    num: 1,
    // @ts-ignore
    fork: () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    send: async (args, next) => {
        const transfer = args.filter(arg => arg?.constructor?.name === 'OffscreenCanvas')
        return await next(args, transfer)
    },
    api: {
        async init(canvas: OffscreenCanvas, opts?: Renderer['opts']) {
            await (cache || (cache = init(canvas, opts)))
        },
        async resize(width: number, height: number) {
            const { renderer } = await cache
            renderer.width = width
            renderer.height = height
        },
        async renderGlTf(data: GlTf, { fov, aspect, near, far, worldMatrix }: PerspectiveCamera) {
            const { renderer, camera, canvas } = await cache,
                [scene] = await gltf.load(data)
            Object.assign(camera, { fov, aspect, near, far })
            camera.setWorldMatrix(worldMatrix)
            renderer.render(scene, camera)
            const blob = await (canvas as any).convertToBlob() as Blob
            return await blob.arrayBuffer()
        },
        async render(meshes: Record<number, PickMesh>,
                     geometries: Record<number, PickGeo>,
                     { fov, aspect, near, far, worldMatrix }: PerspectiveCamera) {
            const { renderer, camera, canvas } = await cache
            Object.assign(camera, { fov, aspect, near, far })
            camera.setWorldMatrix(worldMatrix)
            const scene = new Set<Obj3>(),
                geoMap = { } as Record<number, Geometry>
            for (const { worldMatrix, geoId, id } of Object.values(meshes)) {
                const item = geometries[geoId]
                if (!item) {
                    throw Error(`geometry ${geoId} is not found`)
                }
                const geo = geoMap[geoId] || (geoMap[geoId] = new Geometry(item)),
                    color = new Uint8Array([id & 0xff, (id >> 8) & 0xff, (id >> 16) & 0xff]),
                    mesh = new Mesh(geo, new BasicMaterial({ color }))
                mesh.setWorldMatrix(worldMatrix)
                scene.add(mesh)
            }
            renderer.render(scene, camera)
            const blob = await (canvas as any).convertToBlob() as Blob
            return await blob.arrayBuffer()
        }
    }
})
