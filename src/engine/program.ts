import Renderer from './renderer'

import Cache from '../utils/cache'

export default class Program {
    private compiled = new Cache<Renderer, WebGLProgram>()
    compile(renderer: Renderer) {
        const compiled = this.compiled.get(renderer)
        if (compiled) {
            return compiled
        }

        const { ctx } = renderer,
            prog = ctx.createProgram()
        if (!prog) {
            throw Error(`create webgl2 program failed`)
        }

        for (const { type, src } of this.shaders) {
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

        return this.compiled.set(renderer, prog)
    }
    dispose(renderer: Renderer) {
        const compiled = this.compiled.get(renderer)
        if (compiled) {
            renderer.ctx.deleteProgram(compiled)
        }
    }

    private static counter = 1
    readonly id: number
    constructor(readonly shaders: { type: number, src: string }[]) {
        this.id = Program.counter ++
    }
}

