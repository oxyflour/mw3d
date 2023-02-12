import WebGPURenderer from "./webgpu/renderer"
import ThreeRenderer from "./three/renderer"
import Obj3, { Scene } from "./obj3"
import Mesh from "./mesh"
import Geometry from "./geometry"
import Material from "./material"
import Light from "./light"
import Camera from "./camera"
import RendererBase, { RendererOptions } from "./renderer"
import WebGL2Renderer from "./webgl2/renderer"

export class Renderer extends RendererBase {
    static async create(canvas: HTMLCanvasElement | OffscreenCanvas, opts = { } as RendererOptions) {
        ThreeRenderer
        return navigator.gpu ?
            await WebGPURenderer.create(canvas, opts) :
            new WebGL2Renderer(canvas, opts)
            //new ThreeRenderer(canvas, opts)
    }
}

export {
    Obj3, Scene,
    Mesh,
    Geometry,
    Material,
    Camera,
    Light,
    RendererOptions,
}
export * from './geometry'
export * from './material'
export * from './camera'
export * from './uniform'
