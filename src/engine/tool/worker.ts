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
    worldMatrix: mat4
    geoId: number 
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
        async renderGlTf(data: GlTf, { fov, aspect, near, far }: PerspectiveCamera) {
            const { renderer, camera, canvas } = await cache,
                [scene] = await gltf.load(data)
            Object.assign(camera, { fov, aspect, near, far })
            renderer.render(scene, camera)
            const blob = await (canvas as any).convertToBlob() as Blob
            return await blob.arrayBuffer()
        },
        async render(meshes: Record<number, PickMesh>,
                     geometries: Record<number, PickGeo>,
                     { fov, aspect, near, far }: PerspectiveCamera) {
            const { renderer, camera, canvas } = await cache
            Object.assign(camera, { fov, aspect, near, far })
            const scene = new Set<Obj3>(),
                geoMap = { } as Record<number, Geometry>
            for (const [idx, { worldMatrix, geoId }] of Object.values(meshes).entries()) {
                const item = geometries[geoId]
                if (!item) {
                    throw Error(`geometry ${geoId} is not found`)
                }
                const geo = geoMap[geoId] || (geoMap[geoId] = new Geometry({ ...item })),
                    mesh = new Mesh(geo, new BasicMaterial({ color: [idx, 0, 0] }))
                mat4.getRotation(mesh.rotation.data, worldMatrix)
                mat4.getScaling(mesh.scaling.data, worldMatrix)
                mat4.getTranslation(mesh.position.data, worldMatrix)
                mat4.copy(mesh.worldMatrix, worldMatrix)
                scene.add(mesh)
            }
            renderer.render(scene, camera)
            const blob = await (canvas as any).convertToBlob() as Blob
            return await blob.arrayBuffer()
        }
    }
})
