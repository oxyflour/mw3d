import { vec4 } from "gl-matrix"
import Camera from "./camera"
import Geometry from "./geometry"
import Light from "./light"
import Material from "./material"
import Mesh from "./mesh"
import Obj3, { Scene } from "./obj3"
import { Texture } from "./uniform"

export class RendererOptions {
    size?: { width: number, height: number }
    devicePixelRatio?: number
    sampleCount?: number
}

export class RenderOptions {
    depthTexture?: Texture
    colorTexture?: Texture
    renderClips?: boolean
}

export type RenderMesh = Mesh & { geo: Geometry, mat: Material }

export default class Renderer {
    width = 0
    height = 0
    readonly clearColor = { r: 0, g: 0, b: 0, a: 0 }
    constructor(
        public readonly canvas: HTMLCanvasElement | OffscreenCanvas,
        public readonly opts: RendererOptions) {
        const cv = canvas as HTMLCanvasElement
        if (cv.clientWidth && cv.clientHeight) {
            this.width = cv.width = cv.clientWidth
            this.height = cv.height = cv.clientHeight
        }
    }

    readonly cachedRenderList = {
        revs: { } as Record<number, number>,
        list: [] as Obj3[],
        updated: new Set<Mesh | Light | Material>(),
        opaque: [] as RenderMesh[],
        translucent: [] as RenderMesh[],
        lights: [] as Light[],
    }
    addToUpdated = (...objs: (Obj3 | Material)[]) => {
        for (const obj of objs) {
            if (obj instanceof Mesh || obj instanceof Light || obj instanceof Material) {
                this.cachedRenderList.updated.add(obj)
            }
        }
    }
    getOrderFor(mesh: RenderMesh) {
        mesh
        return 0
    }
    prepare(scene: Scene, camera: Camera) {
        const { revs, list, updated } = this.cachedRenderList
        list.length = 0
        updated.clear()
        camera.updateIfNecessary(revs, this.addToUpdated)
        // TODO: enable this
        // Obj3.update(objs)
        for (const obj of scene) {
            obj.updateIfNecessary(revs, this.addToUpdated)
            obj.walk(obj => (obj instanceof Mesh || obj instanceof Light) && list.push(obj))
        }

        const { opaque, translucent, lights } = this.cachedRenderList
        opaque.length = translucent.length = lights.length = 0
        for (const obj of list) {
            if (obj instanceof Mesh && obj.isVisible && obj.geo && obj.mat) {
                const { mat } = obj
                if (revs[mat.id] !== mat.rev && (revs[mat.id] = mat.rev)) {
                    this.addToUpdated(mat)
                }
                if (obj.mat.prop.a < 1) {
                    translucent.push(obj as any)
                } else {
                    opaque.push(obj as any)
                }
            } else if (obj instanceof Light) {
                lights.push(obj)
            }
        }

        const opaqueSorted = (opaque as (RenderMesh & { computedOrder: number })[])
                .map(item => ((item.computedOrder = this.getOrderFor(item)), item))
                .sort((a, b) => 
                    (a.renderOrder - b.renderOrder) ||
                    (a.computedOrder - b.computedOrder) ||
                    (a.mat.renderOrder - b.mat.renderOrder) ||
                    (a.mat.id - b.mat.id) ||
                    (a.geo.id - b.geo.id)) as RenderMesh[],
            transSorted = (translucent as (RenderMesh & { cameraDist: number })[])
                .map(item => ((item.cameraDist = vec4.dist(item.center, camera.worldPosition)), item))
                .sort((a, b) => b.cameraDist - a.cameraDist) as RenderMesh[],
            sorted = opaqueSorted.concat(transSorted)

        return { lights, updated, sorted }
    }
    render(scene: Scene, camera: Camera, opts = { } as RenderOptions) {
        scene
        camera
        opts
    }
}
