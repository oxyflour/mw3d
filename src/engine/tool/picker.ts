import gltf from "../../utils/gltf"
import { PerspectiveCamera } from "../camera"
import Mesh from "../mesh"
import Obj3 from "../obj3"
import worker, { PickGeo, PickMesh } from "./worker"

export default class Picker {
    static async create(opts?: {
        size?: { width: number, height: number }
    }) {
        const offscreen = document.createElement('canvas') as any,
            canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d'),
            image = document.createElement('img')
        /*
         * debug
         *
        canvas.style.position = 'absolute'
        canvas.style.top = canvas.style.left = '0'
        document.body.appendChild(canvas)
         */
        await worker.init(offscreen.transferControlToOffscreen(), { devicePixelRatio })
        return {
            async pick(scene: Set<Obj3>, camera: PerspectiveCamera,
                    pos: { x: number, y: number }, size: { width: number, height: number }) {
                await worker.resize(size.width, size.height)
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
                const buffer = await worker.render(meshes, geometries, camera)
                await new Promise((resolve, reject) => {
                    image.onload = resolve
                    image.onerror = reject
                    image.src = URL.createObjectURL(new Blob([buffer]))
                })
                canvas.width = size.width
                canvas.height = size.height
                ctx.drawImage(image,
                    0, 0, image.width, image.height,
                    0, 0, size.width, size.height)
                const { data: [r, g, b] } = ctx.getImageData(pos.x, pos.y, 1, 1),
                    idx = r + (g << 8) + (b << 16)
                return idx === 0xffffff ? -1 : idx
            }
        }
    }
}
