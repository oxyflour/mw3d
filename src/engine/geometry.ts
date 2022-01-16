import Program from './program'
import Renderer, { Attr } from './renderer'

import Cache from '../utils/cache'

export default class Geometry {
    compile = Cache.create((renderer: Renderer) => Cache.create((prog: Program) => {
        const { ctx } = renderer,
            arr = ctx.createVertexArray()
        if (!arr) {
            throw Error(`create vertex array failed`)
        }

        ctx.bindVertexArray(arr)

        const program = prog.compile(renderer)
        for (const { name, size, type, normalize, stride, offset, values } of this.attrs) {
            const location = ctx.getAttribLocation(program, name)
            ctx.enableVertexAttribArray(location)
            const buffer = ctx.createBuffer()
            ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer)
            ctx.bufferData(ctx.ARRAY_BUFFER, values, ctx.STATIC_DRAW)
            ctx.vertexAttribPointer(location, size, type, normalize || false, stride || 0, offset || 0)
        }
        if (this.indices) {
            const buffer = ctx.createBuffer()
            ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, buffer)
            ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, this.indices, ctx.STATIC_DRAW)
        }
        return arr
    }))
    dispose(renderer: Renderer, prog: Program) {
        const cache = this.compile.map.get(renderer),
            arr = cache && cache.map.del(prog)
        if (arr) {
            renderer.ctx.deleteVertexArray(arr)
        }
    }

    private static counter = 1
    readonly id: number
    readonly indexType: number
    constructor(readonly attrs: Attr[], readonly indices?: Uint16Array | Uint32Array) {
        this.id = Geometry.counter ++
        this.indexType = indices instanceof Uint16Array ?
            WebGL2RenderingContext.UNSIGNED_SHORT : WebGL2RenderingContext.UNSIGNED_INT
    }
    clone() {
        const { attrs, indices } = this
        return new (this as any).constructor(JSON.parse(JSON.stringify(attrs)), indices)
    }
}

export class BoxGeometry extends Geometry {
    constructor(opts = { } as { size?: number }) {
        const { size = 1 } = opts,
            attrs = [ ] as Attr[],
            h = size / 2,
            positions = new Float32Array([
                -h, -h,  h,
                -h,  h,  h,
                 h, -h,  h,
                 h,  h,  h,
                -h, -h, -h,
                -h,  h, -h,
                 h, -h, -h,
                 h,  h, -h,
            ]),
            normals = new Float32Array([
            ]),
            indices = new Uint16Array([
                0, 2, 1,  1, 2, 3,
                1, 3, 5,  5, 3, 7,
                5, 7, 4,  4, 7, 6,
                4, 6, 0,  0, 6, 2,
                2, 6, 3,  3, 6, 7,
                4, 0, 5,  5, 0, 1,
            ])
        attrs.push({
            name: 'a_position',
            size: 3,
            type: WebGLRenderingContext.FLOAT,
            values: positions
        })
        super(attrs, indices)
    }
}
