import { vec3, quat, vec4 } from 'gl-matrix'

export class Mutable {
    protected isDirty = false
    needsUpdate() {
        return this.isDirty
    }
    update() {
        this.isDirty = false
    }
}

export function range(from: number, to = 0, delta = Math.sign(to - from)) {
    const ret = [] as number[]
    for (let i = from; delta > 0 ? (i < to) : (i > to); i += delta) {
        ret.push(i)
    }
    return ret
}

export function defineArrayProp<T extends Record<string, number>>(
        dict: T,
        data = new Float32Array(Object.keys(dict).length)) {
    const obj = new Mutable() as any as T & Mutable & { data: Float32Array }
    obj.data = data
    for (const [key, idx] of Object.entries(dict)) {
        Object.defineProperty(obj, key, {
            get() {
                return data[idx]
            },
            set(val) {
                (obj as any).isDirty = true
                data[idx] = val
            }
        })
    }
    return obj
}

export class Color4 extends Mutable {
    constructor(readonly data = vec4.create()) {
        super()
    }
    get a() {
        return this.data[3]
    }
    set(r: number, g: number, b: number, a: number, out = this) {
        vec4.set(this.data, r, g, b, a)
        return (this.isDirty = true), out
    }
}

export class Vec3 extends Mutable {
    constructor(readonly data = vec3.create()) {
        super()
    }
    set(x: number, y: number, z: number, out = this) {
        vec3.set(out.data, x, y, z)
        return (this.isDirty = true), out
    }
}

export class Quat extends Mutable {
    constructor(readonly data = quat.create()) {
        super()
    }
    rotX(rad: number, out = this) {
        quat.rotateX(out.data, this.data, rad)
        return (this.isDirty = true), out
    }
    rotY(rad: number, out = this) {
        quat.rotateY(out.data, this.data, rad)
        return (this.isDirty = true), out
    }
    rotZ(rad: number, out = this) {
        quat.rotateZ(out.data, this.data, rad)
        return (this.isDirty = true), out
    }
}

export function rand(begin: number, end: number) {
    return Math.random() * (end - begin) + begin
}
