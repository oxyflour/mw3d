import { Camera, Geometry, Light, Material, Mesh, RendererOptions, Scene, Texture } from '..'
import { mat4 } from 'gl-matrix'

import Renderer, { RenderMesh, RenderOptions } from '../renderer'
import cache from '../../utils/cache'
import glsl from './shader.glsl?raw'
import threeGlsl from '../three/shader.glsl?raw'
import { parse } from '../../utils/chunk'

const MAT4_TMP = mat4.create(),
    GLSL_CHUNKS = parse(glsl)
function split(code: string) {
    const [head = '', body = '{}'] = code.split(/void\s+main\(\)/),
        vars = head.split('\n')
    return { vars, body }
}
function merge(code: string, rest: string) {
    const origin = split(code),
        extra = split(rest)
    return [
        ...origin.vars,
        ...extra.vars.filter(line =>
            !line.startsWith('#include') &&
            !(line.startsWith('uniform') && origin.vars.includes(line))),
        'void main()' + extra.body.replace(/projectionMatrix \* modelViewMatrix/g, 'cameraViewProjection * meshModelMatrix')
    ].join('\n')
}
for (const [name, { vert = '', frag = '' }] of Object.entries(parse(threeGlsl))) {
    GLSL_CHUNKS[name] = {
        vert: merge(GLSL_CHUNKS.common?.vert || '', vert),
        frag: merge(GLSL_CHUNKS.common?.frag || '', frag),
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
    private code = cache((mat: Material, geo: Geometry) => {
        const ret = { ...GLSL_CHUNKS.common }
        if (geo.type === 'fat-line-list') {
            Object.assign(ret, GLSL_CHUNKS.line)
        }
        if (mat.opts.wgsl?.frag === 'fragMainColor') {
            ret.frag = GLSL_CHUNKS.line?.frag || ''
        } else if (mat.opts.wgsl?.frag === 'fragMainDepth') {
            Object.assign(ret, GLSL_CHUNKS.depth)
        }
        return ret
    })
    private prog = cache((code: string) => {
        const [vert = '', frag = ''] = code.split('###CODE###'),
            { ctx } = this,
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
        if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
            const error = ctx.getProgramInfoLog(prog)
            ctx.deleteProgram(prog)
            throw Error(`link webgl program failed: ${error}`)
        }

        return prog
    })
    private vao = cache((prog: WebGLProgram, geo: Geometry) => {
        const { ctx } = this,
            arr = ctx.createVertexArray()
        if (!arr) {
            throw Error(`create vertex array failed`)
        }

        ctx.bindVertexArray(arr)

        const attrNames = ['position', 'normal']
        for (const [idx, arr] of geo.attributes.entries()) {
            const name = attrNames[idx],
                loc = name ? ctx.getAttribLocation(prog, name) : -1
            if (loc >= 0) {
                ctx.enableVertexAttribArray(loc)
                const buffer = ctx.createBuffer()
                ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer)
                ctx.bufferData(ctx.ARRAY_BUFFER, arr, ctx.STATIC_DRAW)
                ctx.vertexAttribPointer(loc, 3, WebGL2RenderingContext.FLOAT, false, 0, 0)
            }
        }

        if (geo.indices) {
            const buffer = ctx.createBuffer()
            ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, buffer)
            ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, geo.indices, ctx.STATIC_DRAW)
        }

        return arr
    })
    private tx = cache((tex: Texture) => {
        const { ctx } = this,
            texture = ctx.createTexture(),
            target = WebGL2RenderingContext.TEXTURE_2D,
            format = WebGL2RenderingContext.RGBA,
            type = WebGL2RenderingContext.UNSIGNED_BYTE,
            { width, height = width } = tex.opts.size as GPUExtent3DDict
        ctx.bindTexture(target, texture)
        ctx.texImage2D(target, 0, format, width, height, 0, format, type, null)
        return texture
    })
    private dt = cache((tex: Texture) => {
        const { ctx } = this,
            texture = ctx.createTexture(),
            target = WebGL2RenderingContext.TEXTURE_2D,
            internal = WebGL2RenderingContext.DEPTH_COMPONENT24,
            format = WebGL2RenderingContext.DEPTH_COMPONENT,
            type = WebGL2RenderingContext.UNSIGNED_INT,
            { width, height = width } = tex.opts.size as GPUExtent3DDict
        ctx.bindTexture(target, texture)
        ctx.texImage2D(target, 0, internal, width, height, 0, format, type, null)
        return texture
    })
    private rt = cache((color?: Texture, depth?: Texture) => {
        const { ctx } = this,
            frameBuffer = ctx.createFramebuffer()
        ctx.bindFramebuffer(ctx.FRAMEBUFFER, frameBuffer)
        if (color) {
            const texture = this.tx(color)
            ctx.framebufferTexture2D(ctx.FRAMEBUFFER,
                ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, texture, 0)
        }

        const depthBuffer = ctx.createRenderbuffer()
        ctx.bindRenderbuffer(ctx.RENDERBUFFER, depthBuffer)
        if (depth) {
            const texture = this.dt(depth)
            ctx.framebufferTexture2D(ctx.FRAMEBUFFER,
                ctx.DEPTH_ATTACHMENT, ctx.TEXTURE_2D, texture, 0)
        } else {
            ctx.framebufferRenderbuffer(ctx.FRAMEBUFFER,
                ctx.DEPTH_ATTACHMENT, ctx.RENDERBUFFER, depthBuffer)
        }

        return { frameBuffer, depthBuffer }
    })
    private updateUniforms(prog: WebGLProgram, entity: Camera | Material | Mesh | Light[]) {
        const { ctx } = this,
            loc = (name: string) => ctx.getUniformLocation(prog, name)
        if (Array.isArray(entity)) {
            ctx.uniform2f(loc('renderCanvasSize'), this.renderSize.width, this.renderSize.height)
            ctx.uniform1i(loc('renderLightNum'), entity.length)
            for (const [idx, light] of entity.slice(0, 4).entries()) {
                const [[worldPosition] = []] = light.uniforms
                worldPosition  && ctx.uniform4fv(loc('renderLightPosition' + idx), worldPosition)
            }
        } else if (entity instanceof Camera) {
            const [[viewProjection, worldPosition] = []] = entity.uniforms
            // Note: webgl view projection range is different
            mat4.multiply(MAT4_TMP, entity.projection, entity.viewMatrix)
            viewProjection && ctx.uniformMatrix4fv(loc('cameraViewProjection'), false, MAT4_TMP)
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
            const { texture, wgsl } = entity.opts
            if (texture) {
                if (wgsl?.frag === 'fragMainDepth') {
                    ctx.uniform1i(loc('materialMapDepth'), 0)
                    ctx.activeTexture(ctx.TEXTURE0)
                    ctx.bindTexture(ctx.TEXTURE_2D, this.dt(texture))
                } else {
                    ctx.uniform1i(loc('materialMap'), 0)
                    ctx.activeTexture(ctx.TEXTURE0)
                    ctx.bindTexture(ctx.TEXTURE_2D, this.tx(texture))
                }
            }
        }
    }
    override resize() {
        super.resize()
        this.ctx.viewport(0, 0, this.renderSize.width, this.renderSize.height)
    }
    private draw(lights: Light[], sorted: RenderMesh[], camera: Camera) {
        const { ctx } = this
        let prog = null as WebGLProgram | null,
            mat = null as Material | null,
            mesh = null as Mesh | null,
            geo = null as Geometry | null
        for (const item of sorted) {
            const code = this.code(item.mat, item.geo),
                program = this.prog(code?.vert + '###CODE###' + code?.frag)
            if (prog !== program && (prog = program)) {
                ctx.useProgram(prog)
                this.updateUniforms(prog, camera)
                this.updateUniforms(prog, lights)
                this.updateUniforms(prog, item.mat)
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
                    WebGL2RenderingContext.UNSIGNED_SHORT : WebGL2RenderingContext.UNSIGNED_INT
                ctx.drawElements(mode, count, type, mesh.offset)
            } else {
                ctx.drawArrays(mode, mesh.offset, count)
            }
        }
    }
    override render(scene: Scene, camera: Camera, opts = { } as RenderOptions) {
        super.render(scene, camera, opts)

        const { ctx } = this
        if (!opts.keepFrame) {
            ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT)
        }

        const { lights, sorted } = this.prepare(scene, camera)
        if (opts.colorTexture || opts.depthTexture) {
            const { frameBuffer, depthBuffer } = this.rt(opts.colorTexture, opts.depthTexture)
            ctx.bindFramebuffer(ctx.FRAMEBUFFER, frameBuffer)
            ctx.bindRenderbuffer(ctx.RENDERBUFFER, depthBuffer)
            ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx.DEPTH_COMPONENT16, this.renderSize.width, this.renderSize.height)
            this.draw(lights, sorted, camera)
        }
        ctx.bindFramebuffer(ctx.FRAMEBUFFER, null)
        this.draw(lights, sorted, camera)
    }
}
