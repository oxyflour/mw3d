export default class Texture {
    constructor(
        readonly width: number, readonly height = width,
        readonly data = null) {
    }
}

export class RenderTarget {
    readonly texture: Texture
    constructor(width: number, height: number) {
        this.texture = new Texture(width, height)
    }
}
