import Obj3, { Scene } from "./obj3"
import Mesh from "./mesh"
import Geometry from "./geometry"
import Material from "./material"
import Light from "./light"
import Camera from "./camera"
import RendererBase, { RendererOptions } from "./renderer"
import WebGPURenderer from "./webgpu/renderer"
import WebGPUTracer from "./tracer/renderer"
import WebGL2Renderer from "./webgl2/renderer"
import ThreeRenderer from "./three/renderer"

export class Renderer extends RendererBase {
    static async create(canvas: HTMLCanvasElement | OffscreenCanvas, opts = { } as RendererOptions & {
        useThree?: boolean
        useWebGL2?: boolean
        useTracer?: boolean
    }) {
        return opts.useThree ?
                new ThreeRenderer(canvas, opts) :
            opts.useWebGL2 ?
                new WebGL2Renderer(canvas, opts) :
            opts.useTracer ?
                await WebGPUTracer.create(canvas, opts) :
            navigator.gpu ?
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
