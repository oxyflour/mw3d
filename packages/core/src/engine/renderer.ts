import Camera from "./camera"
import { Scene } from "./obj3"
import { Texture } from "./uniform"

export class RendererOptions {
    size?: { width: number, height: number }
    devicePixelRatio?: number
    sampleCount?: number
}

export class RenderOptions {
    depthTexture?: Texture
    colorTexture?: Texture
}

export default class Renderer {
    width = 0
    height = 0
    constructor(
        public readonly canvas: HTMLCanvasElement | OffscreenCanvas,
        public readonly opts: RendererOptions) {
        const cv = canvas as HTMLCanvasElement
        if (cv.clientWidth && cv.clientHeight) {
            this.width = cv.width = cv.clientWidth
            this.height = cv.height = cv.clientHeight
        }
    }
    render(scene: Scene, camera: Camera, opts = { } as RenderOptions) {
        scene
        camera
        opts
    }
}
