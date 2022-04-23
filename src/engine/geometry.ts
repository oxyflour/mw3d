import { vec4 } from "gl-matrix"

export interface Attr {
    name: string
    size: number
    values: Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array |
        Uint32Array | Uint8ClampedArray | Float32Array | Float64Array
    stride?: number
    offset?: number
}

export default class Geometry {
    private static counter = 1
    readonly type = 'triangle-list' as GPUPrimitiveTopology
    readonly count: number
    readonly id: number
    readonly min = [Infinity, Infinity, Infinity]
    readonly max = [-Infinity, -Infinity, -Infinity]
    readonly center = vec4.fromValues(0, 0, 0, 0)
    constructor(readonly attrs: Attr[], readonly indices?: Uint16Array | Uint32Array) {
        this.id = Geometry.counter ++
        const arr = attrs.find(item => item.name === 'a_position')
        if (arr) {
            const { min, max, center } = this,
                { values } = arr
            for (let i = 0, n = values.length; i < n; i += 3) {
                const pos = [values[i], values[i + 1], values[i + 2]]
                for (let j = 0; j < 3; j ++) {
                    min[j] = Math.min(min[j], pos[j])
                    max[j] = Math.max(max[j], pos[j])
                    center[j] += pos[j]
                }
            }
            for (let j = 0; j < 3; j ++) {
                center[j] *= values.length ? 3/values.length : 0
            }
        }
        if (indices) {
            this.count = {
                'triangle-list': this.indices.length,
                'line-list': this.indices.length,
            }[this.type] || -1
        } else if (arr) {
            this.count = {
                'triangle-list': arr.values.length / 3,
                'line-list': arr.values.length / 6,
            }[this.type] || -1
        }
    }
}

export class LineList extends Geometry {
    readonly type: GPUPrimitiveTopology
    constructor({ lines }: { lines: [number, number, number][][] }) {
        const pos = [] as number[],
            idx = [] as number[]
        for (const pts of lines) {
            const start = pos.length / 3
            for (const [x, y, z] of pts) {
                pos.push(x, y, z)
            }
            for (let i = 0; i < pts.length - 1; i ++) {
                idx.push(start + i, start + i + 1)
            }
        }
        super([{
            name: 'a_position',
            size: 3,
            values: new Float32Array(pos)
        }, {
            name: 'a_normal',
            size: 3,
            values: new Float32Array(pos.length)
        }], new Uint32Array(idx))
        this.type = 'line-list'
    }
}

export class BoxLines extends LineList {
    constructor({ size = 1 }: { size?: number }) {
        const h = size / 2
        super({
            lines: [
                [[-h, -h, -h], [-h,  h, -h], [-h,  h,  h], [-h, -h,  h], [-h, -h, -h],
                 [ h, -h, -h], [ h,  h, -h], [ h,  h,  h], [ h, -h,  h], [ h, -h, -h]],
                [[-h,  h,  h], [ h,  h,  h]],
                [[-h, -h,  h], [ h, -h,  h]],
                [[-h,  h, -h], [ h,  h, -h]],
            ]
        })
    }
}

export class BoxGeometry extends Geometry {
    constructor({ size = 1 }: { size?: number }) {
        const attrs = [ ] as Attr[],
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
            values: positions
        }, {
            name: 'a_normal',
            size: 3,
            values: normals
        })
        super(attrs, indices)
    }
}
