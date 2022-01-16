import Cache from '../utils/cache'

import Renderer from './renderer'

export default class Texture {
    compile = Cache.create((renderer: Renderer) => {
        const { ctx } = renderer,
            texture = ctx.createTexture()
        ctx.bindTexture(this.target, texture)
        ctx.texImage2D(this.target, 0, this.format,
            this.width, this.height, 0,
            this.format, this.type, this.data)
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
        return texture
    })
    dispose(renderer: Renderer) {
        renderer.ctx.deleteTexture(this.compile.map.del(renderer) || null)
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
    compile = Cache.create((renderer: Renderer) => {
        const { ctx } = renderer,
            texture = this.texture.compile(renderer)

        const frameBuffer = ctx.createFramebuffer()
        ctx.bindFramebuffer(ctx.FRAMEBUFFER, frameBuffer)
        ctx.framebufferTexture2D(ctx.FRAMEBUFFER,
            ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, texture, 0)

        const depthBuffer = ctx.createRenderbuffer()
        ctx.bindRenderbuffer(ctx.RENDERBUFFER, depthBuffer)
        ctx.framebufferRenderbuffer(ctx.FRAMEBUFFER,
            ctx.DEPTH_ATTACHMENT, ctx.RENDERBUFFER, depthBuffer)

        return { frameBuffer, depthBuffer }
    })
    dispose(renderer: Renderer) {
        this.texture.dispose(renderer)
        const { frameBuffer, depthBuffer } = this.compile.map.del(renderer) || { }
        frameBuffer && renderer.ctx.deleteFramebuffer(frameBuffer)
        depthBuffer && renderer.ctx.deleteFramebuffer(depthBuffer)
    }
    readonly texture: Texture
    constructor(width: number, height: number) {
        this.texture = new Texture(width, height)
    }
}
