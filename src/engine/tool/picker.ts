import { PerspectiveCamera } from "../camera"
import Mesh from "../mesh"
import Obj3 from "../obj3"
import worker, { PickGeo, PickMesh } from "./worker"

export default class Picker {
    static async create(opts?: {
        size?: { width: number, height: number }
    }) {
        const offscreen = document.createElement('canvas') as any,
            transfer = document.createElement('canvas') as any
        await worker.init(
            offscreen.transferControlToOffscreen(),
            transfer.transferControlToOffscreen())
        return {
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
        }
    }
}
