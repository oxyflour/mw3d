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

export default class Geometry {
    private static counter = 1
    readonly id: number
    constructor(readonly attrs: Attr[], readonly indices?: Uint16Array | Uint32Array) {
        this.id = Geometry.counter ++
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

                 h, -h, -h,
                 h,  h, -h,
                 h, -h,  h,
                 h,  h,  h,

                -h, -h, -h,
                -h,  h, -h,
                -h, -h,  h,
                -h,  h,  h,

                -h,  h, -h,
                 h,  h, -h,
                -h,  h,  h,
                 h,  h,  h,

                -h, -h, -h,
                 h, -h, -h,
                -h, -h,  h,
                 h, -h,  h,
            ]),
            normals = new Float32Array([
                 0,  0,  1,
                 0,  0,  1,
                 0,  0,  1,
                 0,  0,  1,

                 0,  0, -1,
                 0,  0, -1,
                 0,  0, -1,
                 0,  0, -1,

                 1,  0,  0,
                 1,  0,  0,
                 1,  0,  0,
                 1,  0,  0,

                -1,  0,  0,
                -1,  0,  0,
                -1,  0,  0,
                -1,  0,  0,

                 0,  1,  0,
                 0,  1,  0,
                 0,  1,  0,
                 0,  1,  0,

                 0, -1,  0,
                 0, -1,  0,
                 0, -1,  0,
                 0, -1,  0,
            ]),
            indices = new Uint16Array([
                ...[0, 2, 1,  1, 2, 3],
                ...[0, 1, 2,  1, 3, 2].map(i => i + 4),
                ...[0, 1, 2,  1, 3, 2].map(i => i + 8),
                ...[0, 2, 1,  1, 2, 3].map(i => i + 12),
                ...[0, 2, 1,  1, 2, 3].map(i => i + 16),
                ...[0, 1, 2,  1, 3, 2].map(i => i + 20),
            ])
        attrs.push({
            name: 'a_position',
            size: 3,
            type: WebGLRenderingContext.FLOAT,
            values: positions
        }, {
            name: 'a_normal',
            size: 3,
            type: WebGLRenderingContext.FLOAT,
            values: normals
        })
        super(attrs, indices)
    }
}
