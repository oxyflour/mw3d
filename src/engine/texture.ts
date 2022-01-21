export default class Texture {
    constructor(
        readonly width: number, readonly height = width,
        readonly data = null,
        readonly target = WebGL2RenderingContext.TEXTURE_2D,
        readonly format = WebGL2RenderingContext.RGBA,
        readonly type = WebGL2RenderingContext.UNSIGNED_BYTE) {
    }
}

export class RenderTarget {
    readonly texture: Texture
    constructor(width: number, height: number) {
        this.texture = new Texture(width, height)
    }
}
