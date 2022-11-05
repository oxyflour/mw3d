import { vec4 } from "gl-matrix"
import { AutoIndex } from "../utils/common"
import { range } from "../utils/math"

export interface Attr {
    name: string
    size: number
    values: Int8Array | Int16Array | Int32Array | Uint8Array | Uint16Array |
        Uint32Array | Uint8ClampedArray | Float32Array | Float64Array
    stride?: number
    offset?: number
}

export type GeometryPrimitive = GPUPrimitiveTopology | 'fat-line-list' | 'point-sprite'

export default class Geometry extends AutoIndex {
    readonly type: GeometryPrimitive
    readonly positions: Float32Array
    readonly count: number
    readonly normals?: Float32Array
    readonly indices?: Uint16Array | Uint32Array
    readonly attributes: Float32Array[]

    readonly min = [Infinity, Infinity, Infinity]
    readonly max = [-Infinity, -Infinity, -Infinity]
    readonly center = vec4.fromValues(0, 0, 0, 1)

    constructor({ type, positions, normals, indices, attributes }: {
        type?: GeometryPrimitive
        positions: Float32Array
        normals?: Float32Array
        indices?: Uint32Array | Uint16Array
        attributes?: Float32Array[]
    }) {
        super()
        this.positions = positions
        this.normals = normals
        this.indices = indices
        this.type = type || 'triangle-list'
        this.attributes = [
            this.positions,
            ...(normals ? [normals] : []),
            ...(attributes || []),
        ]

        const { min, max, center } = this
        for (let i = 0, n = positions.length; i < n; i += 3) {
            const pos = [positions[i], positions[i + 1], positions[i + 2]]
            for (let j = 0; j < 3; j ++) {
                min[j] = Math.min(min[j]!, pos[j]!)
                max[j] = Math.max(max[j]!, pos[j]!)
                center[j] += pos[j]!
            }
        }
        for (let j = 0; j < 3; j ++) {
            center[j] /= positions.length ? positions.length/3 : 1
        }
        if (indices) {
            this.count = indices.length
        } else {
            this.count = {
                'point-list': positions.length / 3,
                'line-list': positions.length / 6,
                'line-strip': positions.length / 6,
                'triangle-list': positions.length / 3,
                'triangle-strip': positions.length / 3,
                'fat-line-list': positions.length / 3,
                'point-sprite': positions.length / 3,
            }[this.type] || 0
        }
    }
}

export class SpriteGeometry extends Geometry {
    constructor({ positions = [0, 0, 0], width = 1, height = 1, fixed = false } = { } as {
        width?: number
        height?: number
        fixed?: boolean
        positions?: number[]
    }) {
        const pos = [] as number[],
            idx = [] as number[],
            norm = [] as number[]
        for (let i = 0; i < positions.length; i += 3) {
            const [x = 0, y = 0, z = 0] = positions.slice(i, i + 3),
                start = pos.length
            pos.push(x, y, z, x, y, z, x, y, z, x, y, z)
            idx.push(...[0, 1, 2, 1, 3, 2].map(i => i + start))
            norm.push(
                width, height, fixed ? 1 : 0,
                width, height, fixed ? 1 : 0,
                width, height, fixed ? 1 : 0,
                width, height, fixed ? 1 : 0,
            )
        }
        super({
            type: 'point-sprite',
            positions: new Float32Array(pos),
            indices: new Uint32Array(idx),
            normals: new Float32Array(norm),
        })
    }
}

export class LineList extends Geometry {
    constructor({ lines } = { } as {
        lines: ([number, number, number][] | Float32Array)[]
    }) {
        const pos = [] as number[],
            norm = [] as number[],
            idx = [] as number[]
        for (const pts of lines) {
            const start = pos.length / 3
            if (Array.isArray(pts)) {
                for (let i = 0; i < pts.length - 1; i ++) {
                    const p0 = pts[i]!,
                        p1 = pts[i + 1]!
                    pos.push(...p0, ...p1, ...p0, ...p1)
                    norm.push(...p1, ...p0, ...p1, ...p0)
                }
                for (let i = 0; i < pts.length - 1; i ++) {
                    const j = start + i * 4
                    idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2)
                }
            } else {
                for (let i = 0; i < pts.length - 3; i += 3) {
                    const p0 = pts.slice(i, i + 3),
                        p1 = pts.slice(i + 3, i + 6)
                    pos.push(...p0, ...p1, ...p0, ...p1)
                    norm.push(...p1, ...p0, ...p1, ...p0)
                }
                for (let i = 0; i < pts.length / 3 - 1; i ++) {
                    const j = start + i * 4
                    idx.push(j, j + 1, j + 2, j + 1, j + 3, j + 2)
                }
            }
        }
        super({
            type: 'fat-line-list',
            positions: new Float32Array(pos),
            normals: new Float32Array(norm),
            indices: new Uint32Array(idx)
        })
    }
}

export class BoxLines extends LineList {
    constructor({ size = 1 } = { } as { size?: number }) {
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

export class PlaneXY extends Geometry {
    constructor({
        size = 1,
    } = { } as { size?: number }) {
        super({
            positions: new Float32Array([
                -size, -size, 0,
                -size,  size, 0,
                 size,  size, 0,
                 size, -size, 0,
            ]),
            normals: new Float32Array([
                0, 0, 1,
                0, 0, 1,
                0, 0, 1,
                0, 0, 1,
            ]),
            indices: new Uint32Array([
                0, 2, 1,
                0, 3, 2,
            ])
        })
    }
}

export class SphereGeometry extends Geometry {
    constructor({
        radius = 1,
        phiArr = range(0, 361, 15),
        thetaArr = range(-90, 91, 15)
    } = { } as { radius?: number, phiArr?: number[], thetaArr?: number[] }) {
        const positions = [] as number[],
            normals = [] as number[],
            indices = [] as number[]
        for (const phi of phiArr.map(val => val / 180 * Math.PI)) {
            for (const theta of thetaArr.map(val => val / 180 * Math.PI)) {
                const x = radius * Math.sin(phi) * Math.cos(theta),
                    y = radius * Math.cos(phi) * Math.cos(theta),
                    z = radius * Math.sin(theta)
                positions.push(x, y, z)
                normals.push(x / radius, y / radius, z / radius)
            }
        }
        for (let i = 0, phiNum = phiArr.length; i < phiNum - 1; i ++) {
            for (let j = 0, thetaNum = thetaArr.length; j < thetaNum - 1; j ++) {
                const n = thetaNum,
                    s = i * n + j
                indices.push(
                    s, s + 1, s + 1 + n,
                    s, s + 1 + n, s + n)
            }
        }
        super({
            positions: new Float32Array(positions),
            normals: new Float32Array(normals),
            indices: new Uint32Array(indices)
        })
    }
}

export class BoxGeometry extends Geometry {
    constructor({ size = 1 } = { } as { size?: number }) {
        const h = size / 2,
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
        super({ positions, normals, indices })
    }
}
