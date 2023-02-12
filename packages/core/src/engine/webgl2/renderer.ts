import { Camera, Geometry, Light, Material, Mesh, RendererOptions, Scene, Texture } from '..'
import Renderer, { RenderOptions } from '../renderer'
import cache from '../../utils/cache'

import glsl from './shader.glsl?raw'

const GLSL_CHUNKS = { } as Record<string, Record<string, string>>
for (const chunk of (glsl as string).split('// @chunk:')) {
    const name = chunk.slice(0, chunk.indexOf('\n')).trim(),
        map = GLSL_CHUNKS[name] = { } as Record<string, string>
    for (const part of chunk.split('// @')) {
        const head = part.slice(0, part.indexOf('\n')),
            name = head.trim()
        if (name) {
            map[name] = part.slice(head.length + 1)
        }
    }
}

const PRIMITIVE_MODES = {
    'triangle-list': WebGL2RenderingContext.TRIANGLES,
    'fat-line-list': WebGL2RenderingContext.TRIANGLES,
    "point-sprite": WebGL2RenderingContext.TRIANGLES,
} as Record<Geometry['type'], number>

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
    code = cache((mat: Material) => {
        // TODO
        mat
        return GLSL_CHUNKS.common
    })
    prog = cache((vert: string, frag: string) => {
        const { ctx } = this,
            prog = ctx.createProgram()
        if (!prog) {
            throw Error(`create webgl2 program failed`)
        }

        for (const { type, src } of [{
            type: WebGL2RenderingContext.VERTEX_SHADER,
            src: vert
        }, {
            type: WebGL2RenderingContext.FRAGMENT_SHADER,
            src: frag
        }]) {
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
    vao = cache((prog: WebGLProgram, geo: Geometry) => {
        const { ctx } = this,
            arr = ctx.createVertexArray()
        if (!arr) {
            throw Error(`create vertex array failed`)
        }

        ctx.bindVertexArray(arr)

        const attrNames = ['position', 'normal']
        for (const [idx, arr] of geo.attributes.entries()) {
            const name = attrNames[idx],
                loc = name && ctx.getAttribLocation(prog, name) || 0
            if (loc >= 0) {
                ctx.enableVertexAttribArray(loc)
                const buffer = ctx.createBuffer()
                ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer)
                ctx.bufferData(ctx.ARRAY_BUFFER, arr, ctx.STATIC_DRAW)
                ctx.vertexAttribPointer(loc, 3, WebGLRenderingContext.FLOAT, false, 0, 0)
            }
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
    rt = cache((tex: Texture) => {
        const { ctx } = this,
            texture = this.tex(tex),
            frameBuffer = ctx.createFramebuffer()
        ctx.bindFramebuffer(ctx.FRAMEBUFFER, frameBuffer)
        ctx.framebufferTexture2D(ctx.FRAMEBUFFER,
            ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, texture, 0)

        const depthBuffer = ctx.createRenderbuffer()
        ctx.bindRenderbuffer(ctx.RENDERBUFFER, depthBuffer)
        ctx.framebufferRenderbuffer(ctx.FRAMEBUFFER,
            ctx.DEPTH_ATTACHMENT, ctx.RENDERBUFFER, depthBuffer)

        return { frameBuffer, depthBuffer }
    })
    private updateUniforms(prog: WebGLProgram, entity: Camera | Material | Mesh | Light) {
        const { ctx } = this,
            loc = (name: string) => ctx.getUniformLocation(prog, name)
        if (entity instanceof Light) {
        } else if (entity instanceof Camera) {
            const [[viewProjection, worldPosition] = []] = entity.uniforms
            viewProjection && ctx.uniformMatrix4fv(loc('cameraViewProjection'), false, viewProjection)
            worldPosition  && ctx.uniform4fv(loc('cameraWorldPosition'), worldPosition)
        } else if (entity instanceof Mesh) {
            const [[modelMatrix, worldPosition] = []] = entity.uniforms
            modelMatrix   && ctx.uniformMatrix4fv(loc('meshModelMatrix'), false, modelMatrix)
            worldPosition && ctx.uniform4fv(loc('meshWorldPosition'), worldPosition)
        } else if (entity instanceof Material) {
            const [[prop, clip] = []] = entity.uniforms as [Float32Array, Float32Array][]
            prop && ctx.uniform4fv(loc('materialColor'), prop, 0, 4)
            prop && ctx.uniform4fv(loc('materialProp'),  prop, 4, 4)
            clip && ctx.uniform4fv(loc('materialClip'),  clip)
        }
    }
    override resize() {
        super.resize()
        this.ctx.viewport(0, 0, this.renderSize.width, this.renderSize.height)
    }
    override render(scene: Scene, camera: Camera, opts = { } as RenderOptions) {
        super.render(scene, camera, opts)

        const { ctx } = this,
            tex = opts.colorTexture || opts.depthTexture
        if (tex) {
            const { frameBuffer, depthBuffer } = this.rt(tex)
            ctx.bindFramebuffer(ctx.FRAMEBUFFER, frameBuffer)
            ctx.bindRenderbuffer(ctx.RENDERBUFFER, depthBuffer)
            ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx.DEPTH_COMPONENT16, this.width, this.height)
        } else {
            ctx.bindFramebuffer(ctx.FRAMEBUFFER, null)
        }

        if (!opts.keepFrame) {
            ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT)
        }

        const { lights, sorted } = this.prepare(scene, camera)
        let prog = null as WebGLProgram | null,
            mat = null as Material | null,
            mesh = null as Mesh | null,
            geo = null as Geometry | null
        for (const item of sorted) {
            const code = this.code(item.mat),
                program = this.prog(code?.vert || '', code?.frag || '')
            if (prog !== program && (prog = program)) {
                ctx.useProgram(prog)
                this.updateUniforms(prog, camera)
                for (const light of lights) {
                    this.updateUniforms(prog, light)
                }
            }
            if (mat !== item.mat && (mat = item.mat)) {
                this.updateUniforms(prog, mat)
            }
            if (mesh !== item && (mesh = item)) {
                this.updateUniforms(prog, mesh)
            }
            if (geo !== item.geo && (geo = item.geo)) {
                ctx.bindVertexArray(this.vao(prog, geo))
            }
            const mode = PRIMITIVE_MODES[geo.type] || WebGL2RenderingContext.TRIANGLES,
                count = mesh.count > 0 ? mesh.count : geo.count
            if (geo.indices) {
                const type = geo.indices instanceof Uint16Array ?
                    WebGL2RenderingContext.UNSIGNED_SHORT : WebGLRenderingContext.UNSIGNED_INT
                ctx.drawElements(mode, count, type, mesh.offset)
            } else {
                ctx.drawArrays(mode, mesh.offset, count)
            }
        }
    }
}
