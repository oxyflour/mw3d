import { vec3, quat, vec4 } from 'gl-matrix'
import { Mutable } from './common'

export function range(from: number, to = 0, delta = Math.sign(to - from)) {
    const ret = [] as number[]
    for (let i = from; delta > 0 ? (i < to) : (i > to); i += delta) {
        ret.push(i)
    }
    return ret
}

export interface Array<T> {
    readonly length: number;
    [n: number]: T;
}
export function MutableArray<T extends { [n: string]: number }>(dict: T) {
    class MutableArray extends Mutable {
        constructor(readonly data = Object.values(dict)) {
            super()
            for (const [idx, key] of Object.keys(dict).entries()) {
                Object.defineProperty(this, key, {
                    get() {
                        return this.data[idx]
                    },
                    set(val) {
                        this.rev ++
                        this.data[idx] = val
                    }
                })
            }
        }
    }
    // @ts-ignore
    return MutableArray as new (data?: Array<number>) => Mutable & T
}

export class Color4 extends MutableArray({
    r: 0,
    g: 0,
    b: 0,
    a: 1,
}) {
    constructor(readonly data = vec4.create()) {
        super(data)
    }
}

export class Vec3 extends MutableArray({ x: 0, y: 0, z: 0 }) {
    constructor(readonly data = vec3.create()) {
        super(data)
    }
    set(x: number, y: number, z: number, out = this) {
        vec3.set(this.data, x, y, z)
        return (this.rev ++), out
    }
}

export class Quat extends MutableArray({ x: 0, y: 0, z: 0, w: 1 }) {
    constructor(readonly data = quat.create()) {
        super(data)
    }
    rotX(rad: number, out = this) {
        quat.rotateX(out.data, this.data, rad)
        return (this.rev ++), out
    }
    rotY(rad: number, out = this) {
        quat.rotateY(out.data, this.data, rad)
        return (this.rev ++), out
    }
    rotZ(rad: number, out = this) {
        quat.rotateZ(out.data, this.data, rad)
        return (this.rev ++), out
    }
}

export function rand(begin: number, end: number) {
    return Math.random() * (end - begin) + begin
}
