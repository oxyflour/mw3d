import Material from '../material'
import Geometry from '../geometry'
import Texture, { RenderTarget } from '../texture'

import cache from '../../utils/cache'

export default class Cache {
    constructor(readonly ctx: WebGL2RenderingContext) { }
    clearColor = { r: 0, g: 0, b: 0, a: 0 }
    size = { width: 0, height: 0 }
    loc = cache((_: WebGLProgram) => {
        return { } as Record<string, WebGLUniformLocation | null>
    })
    private cachedProgs = { } as Record<string, WebGLProgram & { progId: number }>
    program = cache((mat: Material) => {
        const key = (mat.shaders.glsl || [])
            .sort((a, b) => a.type - b.type)
            .map(item => `${item.type}//${item.src}`).join('//')
        if (this.cachedProgs[key]) {
            return this.cachedProgs[key]
        }

        const { ctx } = this,
            prog = ctx.createProgram()
        if (!prog) {
            throw Error(`create webgl2 program failed`)
        }

        for (const { type, src } of mat.shaders.glsl || []) {
            const shader = ctx.createShader(type)
            if (!shader) {
                throw Error(`create webgl2 shader (type ${type}) failed`)
            }

            ctx.shaderSource(shader, src)
            ctx.compileShader(shader)

            const compiled = ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)
            if (!compiled) {
                const error = ctx.getShaderInfoLog(shader)
                ctx.deleteShader(shader)
                console.warn(`create shader (type: ${type}) failed: ${error}`)
            }
            ctx.attachShader(prog, shader)
        }

        ctx.linkProgram(prog)
        const linked = ctx.getProgramParameter(prog, ctx.LINK_STATUS);
        if (!linked) {
            ctx.deleteProgram(prog)
            throw Error(`link webgl2 program failed`)
        }

        return this.cachedProgs[key] = Object.assign(prog, { progId: Object.keys(this.cachedProgs).length })
    })
    geometry = cache((prog: WebGLProgram, geo: Geometry) => {
        const { ctx } = this,
            arr = ctx.createVertexArray()
        if (!arr) {
            throw Error(`create vertex array failed`)
        }

        ctx.bindVertexArray(arr)

        for (const { name, size, type, normalize, stride, offset, values } of geo.attrs) {
            const location = ctx.getAttribLocation(prog, name)
            if (location >= 0) {
                ctx.enableVertexAttribArray(location)
                const buffer = ctx.createBuffer()
                ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer)
                ctx.bufferData(ctx.ARRAY_BUFFER, values, ctx.STATIC_DRAW)
                ctx.vertexAttribPointer(location, size, type, normalize || false, stride || 0, offset || 0)
            }
        }
        if (geo.indices) {
            const buffer = ctx.createBuffer()
            ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, buffer)
            ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, geo.indices, ctx.STATIC_DRAW)
        }
        return arr
    })
    renderTarget = cache((renderTarget: RenderTarget) => {
        const { ctx } = this,
            texture = this.texture(renderTarget.texture)

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
    texture = cache((text: Texture) => {
        const { ctx } = this,
            texture = ctx.createTexture()
        ctx.bindTexture(text.target, texture)
        ctx.texImage2D(text.target, 0, text.format,
            text.width, text.height, 0,
            text.format, text.type, text.data)
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
        return texture
    })
}
