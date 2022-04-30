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
            { size = { width: 100, height: 100 } } = opts || { }
        await worker.init(offscreen.transferControlToOffscreen(), { devicePixelRatio, size })
        return {
            async pick(scene: Set<Obj3>, camera: PerspectiveCamera,
                    pos: { x: number, y: number }, size?: { width: number, height: number }) {
                size && await worker.resize(size.width, size.height)
                const meshes = { } as Record<number, PickMesh>,
                    geometries = { } as Record<number, PickGeo>
                for (const obj of scene) {
                    obj.walk(obj => {
                        if (obj instanceof Mesh) {
                            const { worldMatrix, geo } = obj
                            meshes[obj.id] = { worldMatrix, geoId: geo.id }
                            const { type, positions, normals, indices } = geo
                            geometries[geo.id] = { type, positions, normals, indices }
                        }
                    })
                }
                const
                    //buffer = await worker.render(meshes, geometries, camera),
                    buffer = await worker.renderGlTf(gltf.save([scene]), camera),
                    image = document.createElement('img')
                console.log(buffer)
                image.src = URL.createObjectURL(new Blob([buffer]))
                image.style.position = 'absolute'
                image.style.zIndex = '1000'
                image.style.top = '0'
                image.style.left = '0'
                if (size) {
                    image.style.width = size.width + 'px'
                    image.style.height = size.height + 'px'
                }
                document.body.append(image)
            }
        }
    }
}
