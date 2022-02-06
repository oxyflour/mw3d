import { vec3, quat } from 'gl-matrix'

export class Vec3 {
    isDirty = false
    constructor(readonly data = vec3.create()) {
    }
    set(x: number, y: number, z: number, out = this) {
        vec3.set(out.data, x, y, z)
        return (this.isDirty = true), out
    }
}

export class Quat {
    isDirty = false
    constructor(readonly data = quat.create()) {
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
