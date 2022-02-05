import Obj3 from '../obj3'
import Mesh from '../mesh'
import Material from '../material'
import Camera from '../camera'
import Geometry from '../geometry'
import Light from '../light'
import Texture, { RenderTarget } from '../texture'

import cache from '../../utils/cache'
import Uniform from '../uniform'

class Cache {
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

export default class Renderer {
    private updateUniforms(prog: WebGLProgram, uniforms: Uniform[]) {
        const { ctx } = this,
            locs = this.cache.loc(prog)
        for (const { name, values } of uniforms) {
            const location = locs[name] || (locs[name] = ctx.getUniformLocation(prog, name))
            if (values.length === 4) {
                ctx.uniform4fv(location, values)
            } else if (values.length === 16) {
                ctx.uniformMatrix4fv(location, false, values)
            } else {
                throw Error(`not implemented type ${typeof values} for unifrom ${name}`)
            }
        }
    }

    get clearColor() {
        return this.cache.clearColor
    }
    set clearColor({ r, g, b, a }) {
        Object.assign(this.cache.clearColor, { r, g, b, a })
        this.ctx.clearColor(r, g, b, a)
    }

    private resize(width: number, height: number) {
        const { ctx, canvas, cache } = this
        ctx.viewport(0, 0,
            canvas.width = cache.size.width = width,
            canvas.height = cache.size.height = height)
    }
    get width() {
        return this.cache.size.width
    }
    set width(val) {
        this.resize(val, this.cache.size.height)
    }
    get height() {
        return this.cache.size.height
    }
    set height(val) {
        this.resize(this.cache.size.width, val)
    }

    readonly ctx: WebGL2RenderingContext
    readonly cache: Cache
    constructor(readonly canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('webgl2')
        if (!ctx || !(ctx instanceof WebGL2RenderingContext)) {
            throw Error(`create webgl2 context failed`)
        }

        this.ctx = ctx
        ctx.enable(ctx.DEPTH_TEST)
        ctx.enable(ctx.CULL_FACE)

        this.cache = new Cache(ctx)
        this.cache.size.width = canvas.width
        this.cache.size.height = canvas.height
    }

    render(objs: Set<Obj3>, camera: Camera, target = null as null | RenderTarget) {
        const { ctx } = this
        if (target) {
            const { frameBuffer, depthBuffer } = this.cache.renderTarget(target)
            ctx.bindFramebuffer(ctx.FRAMEBUFFER, frameBuffer)
            ctx.bindRenderbuffer(ctx.RENDERBUFFER, depthBuffer)
            ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx.DEPTH_COMPONENT16, this.width, this.height)
        } else {
            ctx.bindFramebuffer(ctx.FRAMEBUFFER, null)
        }
        ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT)

        const meshes = [] as Mesh[],
            lights = [] as Light[],
            progs = {} as Record<number, WebGLProgram & { progId: number }>
        camera.updateIfNecessary()
        for (const obj of objs) {
            obj.updateIfNecessary()
            obj.walk(obj => {
                if (obj instanceof Mesh && obj.isVisible) {
                    meshes.push(obj)
                    progs[obj.mat.id] = this.cache.program(obj.mat)
                } else if (obj instanceof Light) {
                    lights.push(obj)
                }
            })
        }

        const sorted = meshes.sort((a, b) => 
            (a.renderOrder - b.renderOrder) ||
            (progs[a.mat.id]?.progId - progs[b.mat.id]?.progId) ||
            (a.mat.id - b.mat.id) ||
            (a.geo.id - b.geo.id))

        let prog: WebGLProgram,
            mat: Material,
            geo: Geometry
        for (const mesh of sorted) {
            if (prog !== progs[mesh.mat.id] && (prog = progs[mesh.mat.id])) {
                ctx.useProgram(prog)
                this.updateUniforms(prog, camera.uniforms)
                for (const light of lights) {
                    this.updateUniforms(prog, light.uniforms)
                }
            }
            if (mat !== mesh.mat && (mat = mesh.mat)) {
                this.updateUniforms(prog, mat.uniforms)
            }
            if (geo !== mesh.geo && (geo = mesh.geo)) {
                ctx.bindVertexArray(this.cache.geometry(prog, geo))
            }
            const { uniforms, offset, count, mode } = mesh
            this.updateUniforms(prog, uniforms)
            if (geo.indices) {
                const type = geo.indices instanceof Uint16Array ?
                    WebGL2RenderingContext.UNSIGNED_SHORT : WebGL2RenderingContext.UNSIGNED_INT
                ctx.drawElements(mode, count, type, offset)
            } else {
                ctx.drawArrays(mode, offset, count)
            }
        }
    }
}
