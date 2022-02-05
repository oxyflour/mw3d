import Obj3 from '../obj3'
import Mesh from '../mesh'
import Material from '../material'
import Camera from '../camera'
import Geometry from '../geometry'
import Light from '../light'
import Uniform from '../uniform'
import { RenderTarget } from '../texture'

import Cache from './cache'

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
