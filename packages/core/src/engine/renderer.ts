import Camera from "./camera"
import { Scene } from "./obj3"
import { Texture } from "./uniform"

export class RendererOptions {
    size?: { width: number, height: number }
    devicePixelRatio?: number
    sampleCount?: number
}

export default class Renderer {
    constructor(
        public readonly canvas: HTMLCanvasElement | OffscreenCanvas,
        public readonly opts: RendererOptions) {
        const cv = canvas as HTMLCanvasElement
        if (cv.clientWidth && cv.clientHeight) {
            cv.width = cv.clientWidth
            cv.height = cv.clientHeight
        }
    }
    render(scene: Scene, camera: Camera, opts = { } as {
        depthTexture?: Texture
        colorTexture?: Texture
    }) {
        scene
        camera
        opts
    }
}
