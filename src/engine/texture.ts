import Cache from '../utils/cache'

import Renderer from './renderer'

export default class Texture {
    private compiled = new Cache<Renderer, WebGLTexture | null>()
    compile(renderer: Renderer) {
        const compiled = this.compiled.get(renderer)
        if (compiled) {
            return compiled
        }

        const { ctx } = renderer,
            texture = ctx.createTexture()
        ctx.bindTexture(this.target, texture)
        ctx.texImage2D(this.target, 0, this.format,
            this.width, this.height, 0,
            this.format, this.type, this.data)
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
        return this.compiled.set(renderer, texture)
    }
    dispose(renderer: Renderer) {
        const compiled = this.compiled.get(renderer)
        if (compiled) {
            renderer.ctx.deleteTexture(compiled)
        }
    }
    constructor(
        readonly width: number, readonly height = width,
        readonly data = null,
        readonly target = WebGL2RenderingContext.TEXTURE_2D,
        readonly format = WebGL2RenderingContext.RGBA,
        readonly type = WebGL2RenderingContext.UNSIGNED_BYTE) {
    }
}

export class RenderTarget {
    private compiled = new Cache<Renderer, WebGLFramebuffer | null>()
    compile(renderer: Renderer) {
        const compiled = this.compiled.get(renderer)
        if (compiled) {
            return compiled
        }

        const { ctx } = renderer,
            texture = this.texture.compile(renderer),
            frame = ctx.createFramebuffer()
        ctx.bindFramebuffer(ctx.FRAMEBUFFER, frame)
        ctx.framebufferTexture2D(ctx.FRAMEBUFFER,
            ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, texture, 0)
        return this.compiled.set(renderer, frame)
    }
    dispose(renderer: Renderer) {
        this.texture.dispose(renderer)
        const compiled = this.compiled.get(renderer)
        if (compiled) {
            renderer.ctx.deleteFramebuffer(compiled)
        }
    }
    readonly texture: Texture
    constructor(width: number, height: number) {
        this.texture = new Texture(width, height)
    }
}
