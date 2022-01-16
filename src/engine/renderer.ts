import { mat4, vec4 } from 'gl-matrix'

import Obj3 from './obj3'
import Mesh from './mesh'
import Material, { BasicMaterial } from './material'
import Camera from './camera'
import Program from './program'
import Geometry from './geometry'
import { RenderTarget } from './texture'

import Cache from '../utils/cache'

export interface Attr {
    name: string
    size: number
    type: number
    values: number | Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array |
        Uint32Array | Uint8ClampedArray | Float32Array | Float64Array | DataView | ArrayBuffer | null,
    normalize?: boolean
    stride?: number
    offset?: number
}

export type Uniform = { name: string } & ({
    type: 'mat4'
    values: mat4
} | {
    type: 'vec4'
    values: vec4
})

export default class Renderer {
    private getLocations = Cache.create((_: Program) => ({ } as Record<string, WebGLUniformLocation | null>))
    private updateUniforms(prog: Program, uniforms: Uniform[]) {
        const { ctx } = this,
            locs = this.getLocations(prog),
            compiled = prog.compile(this)
        for (const { name, type, values } of uniforms) {
            const location = locs[name] || (locs[name] = ctx.getUniformLocation(compiled, name))
            if (type === 'vec4') {
                ctx.uniform4fv(location, values)
            } else if (type === 'mat4') {
                ctx.uniformMatrix4fv(location, false, values)
            } else {
                throw Error(`not implemented type ${type} for unifrom ${name}`)
            }
        }
    }

    private cachedClearColor = { r: 0, g: 0, b: 0, a: 0 }
    get clearColor() {
        return this.cachedClearColor
    }
    set clearColor({ r, g, b, a }) {
        Object.assign(this.cachedClearColor, { r, g, b, a })
        this.ctx.clearColor(r, g, b, a)
    }

    private cachedSize = { width: 0, height: 0 }
    private resize(width: number, height: number) {
        const { ctx, canvas, cachedSize } = this
        ctx.viewport(0, 0,
            canvas.width = cachedSize.width = width,
            canvas.height = cachedSize.height = height)
    }
    get width() {
        return this.cachedSize.width
    }
    set width(val) {
        this.resize(val, this.cachedSize.height)
    }
    get height() {
        return this.cachedSize.height
    }
    set height(val) {
        this.resize(this.cachedSize.width, val)
    }

    readonly ctx: WebGL2RenderingContext
    constructor(readonly canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('webgl2')
        if (!ctx || !(ctx instanceof WebGL2RenderingContext)) {
            throw Error(`create webgl2 context failed`)
        }

        this.ctx = ctx
        ctx.enable(ctx.DEPTH_TEST)
        ctx.enable(ctx.CULL_FACE)

        this.cachedSize.width = canvas.width
        this.cachedSize.height = canvas.height
    }

    render(objs: Set<Obj3>, camera: Camera, target = null as null | RenderTarget) {
        const { ctx } = this
        if (target) {
            const { frameBuffer, depthBuffer } = target.compile(this)
            ctx.bindFramebuffer(ctx.FRAMEBUFFER, frameBuffer)
            ctx.bindRenderbuffer(ctx.RENDERBUFFER, depthBuffer)
            ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx.DEPTH_COMPONENT16, this.width, this.height)
        } else {
            ctx.bindFramebuffer(ctx.FRAMEBUFFER, null)
        }
        ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT)

        camera.updateIfNecessary()
        for (const obj of objs) {
            obj.updateIfNecessary()
        }

        const sorted = Array.from(objs as Set<Mesh>)
            .filter(obj => obj instanceof Mesh).sort((a, b) => {
                return (a.renderOrder - b.renderOrder) ||
                    (a.mat.prog.id - b.mat.prog.id) ||
                    (a.mat.id - b.mat.id) ||
                    (a.geo.id - b.geo.id)
            })

        let prog = null as Program | null,
            mat = null as Material | null,
            geo = null as Geometry | null
        for (const mesh of sorted) {
            if (prog !== mesh.mat.prog && (prog = mesh.mat.prog)) {
                ctx.useProgram(prog.compile(this))
                this.updateUniforms(prog, camera.uniforms)
            }
            if (mat !== mesh.mat && (mat = mesh.mat)) {
                this.updateUniforms(prog, mat.uniforms)
            }
            if (geo !== mesh.geo && (geo = mesh.geo)) {
                ctx.bindVertexArray(geo.compile(this)(prog))
            }
            const { uniforms, start, count, mode } = mesh
            this.updateUniforms(prog, uniforms)
            if (geo.indices) {
                const type = geo.indexType
                ctx.drawElements(mode, count, type, start)
            } else {
                ctx.drawArrays(mode, start, count)
            }
        }
    }
}
