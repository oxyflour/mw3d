import { Camera, Geometry, Material, Mesh, Renderer, RendererOptions, Scene, Texture, Uniform } from '..'
import cache from '../../utils/cache'
import { RenderOptions } from '../renderer'

export default class WebGL2Renderer extends Renderer {
    private ctx: WebGL2RenderingContext
    constructor(canvas: HTMLCanvasElement | OffscreenCanvas, opts = { } as RendererOptions) {
        super(canvas, opts)
        const ctx = canvas.getContext('webgl2')
        if (!ctx || !(ctx instanceof WebGL2RenderingContext)) {
            throw Error(`create webgl2 context failed`)
        }

        this.ctx = ctx
        ctx.enable(ctx.DEPTH_TEST)
        ctx.enable(ctx.CULL_FACE)
    }
    prog = cache((mat: Material) => {
        const { ctx } = this,
            prog = ctx.createProgram()
        if (!prog) {
            throw Error(`create webgl2 program failed`)
        }

        mat
        for (const { type, src } of []/* WIP: mat.code */) {
            const shader = ctx.createShader(type)
            if (!shader) {
                throw Error(`create shader failed`)
            }
            ctx.shaderSource(shader, src)
            ctx.compileShader(shader)

            const status = ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)
            if (!status) {
                const error = ctx.getShaderInfoLog(shader)
                ctx.deleteShader(shader)
                console.warn(`create shader failed: ${error}`)
            }
            ctx.attachShader(prog, shader)
        }

        ctx.linkProgram(prog)
        const status = ctx.getProgramParameter(prog, ctx.LINK_STATUS)
        if (!status) {
            ctx.deleteProgram(prog)
            throw Error(`link webgl program failed`)
        }

        return prog
    })
    geo = cache((geo: Geometry) => {
        const { ctx } = this,
            arr = ctx.createVertexArray()
        if (!arr) {
            throw Error(`create vertex array failed`)
        }

        ctx.bindVertexArray(arr)

        for (const [loc, arr] of geo.attributes.entries()) {
            ctx.enableVertexAttribArray(loc)
            const buffer = ctx.createBuffer()
            ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer)
            ctx.bufferData(ctx.ARRAY_BUFFER, arr, ctx.STATIC_DRAW)
            ctx.vertexAttribPointer(loc, arr.byteLength,
                0,      // WIP
                false,  // WIP
                0,      // WIP
                0,      // WIP
            )
        }

        if (geo.indices) {
            const buffer = ctx.createBuffer()
            ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, buffer)
            ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, geo.indices, ctx.STATIC_DRAW)
        }

        return arr
    })
    tex = cache((_: Texture) => {
        const { ctx } = this
        return ctx.createTexture()
    })
    depbuf = cache((_: Texture) => {
        const { ctx } = this,
            depthBuffer = ctx.createFramebuffer()
        ctx.bindFramebuffer(ctx.RENDERBUFFER, depthBuffer)
        ctx.framebufferRenderbuffer(ctx.FRAMEBUFFER,
                ctx.DEPTH_ATTACHMENT, ctx.RENDERBUFFER, depthBuffer)
        return depthBuffer
    })
    private updateUniforms(prog: WebGLProgram, uniforms: Uniform[]) {
        const { ctx } = this
        uniforms
        for (const { name, type, values } of []/* WIP: uniforms */) {
            const location = ctx.getUniformLocation(prog, name)
            if (type === 'vec4') {
                ctx.uniform4fv(location, values)
            } else if (type === 'mat4') {
                ctx.uniformMatrix4fv(location, false, values)
            } else {
                throw Error(`not implemented type ${type} for unifrom ${name}`)
            }
        }
    }
    override render(scene: Scene, camera: Camera, opts = { } as RenderOptions) {
        super.render(scene, camera, opts)

        const { ctx } = this
        if (opts.depthTexture) {
            const depthBuffer = this.depbuf(opts.depthTexture)
            ctx.bindRenderbuffer(ctx.RENDERBUFFER, depthBuffer)
            ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx.DEPTH_COMPONENT16, this.width, this.height)
        } else {
            ctx.bindFramebuffer(ctx.FRAMEBUFFER, null)
        }
        ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT)

        const { lights, sorted } = this.prepare(scene, camera)
        let prog = null as WebGLProgram | null,
            mesh = null as Mesh | null,
            geo = null as Geometry | null
        for (const item of sorted) {
            const program = this.prog(item.mat)
            if (prog !== program && (prog = program)) {
                ctx.useProgram(prog)
                this.updateUniforms(prog, camera.uniforms)
                for (const light of lights) {
                    this.updateUniforms(prog, light.uniforms)
                }
            }
            if (mesh !== item && (mesh = item)) {
                this.updateUniforms(prog, mesh.uniforms)
            }
            if (geo !== item.geo && (geo = item.geo)) {
                ctx.bindVertexArray(this.geo(geo))
            }
            /* WIP: mode */
            const mode = 0
            if (geo.indices) {
                const type = geo.indices instanceof Uint16Array ?
                    WebGL2RenderingContext.UNSIGNED_SHORT : WebGLRenderingContext.UNSIGNED_INT
                ctx.drawElements(mode, mesh.count, type, mesh.offset)
            } else {
                ctx.drawArrays(mode, mesh.offset, mesh.count)
            }
        }
    }
}
