import Obj3, { Scene } from "./obj3"
import Mesh from "./mesh"
import Geometry from "./geometry"
import Material from "./material"
import Light from "./light"
import Camera from "./camera"
import RendererBase, { RendererOptions } from "./renderer"
import WebGPURenderer from "./webgpu/renderer"
import WebGL2Renderer from "./webgl2/renderer"

export class Renderer extends RendererBase {
    static async create(canvas: HTMLCanvasElement | OffscreenCanvas, opts = { } as RendererOptions & { useThree?: boolean }) {
        if (opts.useThree) {
            console.warn(`TODO: enable code spliting`)
            /*
            const { default: ThreeRenderer } = await import('./three/renderer')
            return new ThreeRenderer(canvas, opts)
             */
        }
        return navigator.gpu ?
            await WebGPURenderer.create(canvas, opts) :
            new WebGL2Renderer(canvas, opts)
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
    WebGL2Renderer,
    WebGPURenderer,
}
export * from './geometry'
export * from './material'
export * from './camera'
export * from './uniform'
