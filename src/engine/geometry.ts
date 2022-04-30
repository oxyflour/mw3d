import { vec4 } from "gl-matrix"
import { range } from "../utils/math"

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
    readonly id: number

    readonly type: GPUPrimitiveTopology
    readonly positions: Float32Array
    readonly count: number
    readonly normals?: Float32Array
    readonly indices?: Uint16Array | Uint32Array

    readonly min = [Infinity, Infinity, Infinity]
    readonly max = [-Infinity, -Infinity, -Infinity]
    readonly center = vec4.fromValues(0, 0, 0, 0)

    constructor({ type, positions, normals, indices }: {
        type?: GPUPrimitiveTopology
        positions: Float32Array
        normals?: Float32Array
        indices?: Uint32Array | Uint16Array
    }) {
        this.id = Geometry.counter ++
        this.positions = positions
        this.normals = normals
        this.indices = indices
        this.type = type || 'triangle-list'

        const { min, max, center } = this
        for (let i = 0, n = positions.length; i < n; i += 3) {
            const pos = [positions[i], positions[i + 1], positions[i + 2]]
            for (let j = 0; j < 3; j ++) {
                min[j] = Math.min(min[j], pos[j])
                max[j] = Math.max(max[j], pos[j])
                center[j] += pos[j]
            }
        }
        for (let j = 0; j < 3; j ++) {
            center[j] /= positions.length ? positions.length/3 : 1
        }
        if (indices) {
            this.count = {
                'triangle-list': this.indices.length,
                'line-list': this.indices.length,
            }[this.type] || 0
        } else {
            this.count = {
                'triangle-list': positions.length / 3,
                'line-list': positions.length / 6,
            }[this.type] || 0
        }
    }
}

export class LineList extends Geometry {
    constructor({ lines }: { lines: [number, number, number][][] }) {
        const pos = [] as number[],
            norm = [] as number[],
            idx = [] as number[]
        for (const pts of lines) {
            const start = pos.length / 3
            for (const [x, y, z] of pts) {
                pos.push(x, y, z)
                norm.push(0, 0, 1)
            }
            for (let i = 0; i < pts.length - 1; i ++) {
                idx.push(start + i, start + i + 1)
            }
        }
        super({
            type: 'line-list',
            positions: new Float32Array(pos),
            normals: new Float32Array(norm),
            indices: new Uint32Array(idx)
        })
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

export class SphereGeometry extends Geometry {
    constructor({
        radius = 1,
        phiArr = range(0, 361, 15),
        thetaArr = range(-90, 91, 15)
    }: { radius?: number, phiArr?: number[], thetaArr?: number[] }) {
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
    constructor({ size = 1 }: { size?: number }) {
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
