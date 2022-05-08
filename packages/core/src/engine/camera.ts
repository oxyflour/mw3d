import { mat4 } from 'gl-matrix'
import { MutableArray } from '../utils/math'

import Obj3, { ObjOpts } from './obj3'

export default class Camera extends Obj3 {
    private viewProjection = mat4.create()
    private viewMatrix = mat4.create()

    readonly bindingGroup = 1
    readonly uniforms = [
        [
            this.viewProjection,
            this.worldPosition,
        ]
    ]

    protected override update() {
        super.update()
        mat4.invert(this.viewMatrix, this.worldMatrix)
        mat4.multiply(this.viewProjection, this.projection, this.viewMatrix)
    }
    readonly projection: mat4
    constructor(opts?: {
        projection: mat4
    } & ObjOpts) {
        super(opts)
        this.projection = opts?.projection || mat4.create()
    }
}

export class PerspectiveProp extends MutableArray({
    fov: 30 * Math.PI / 180,
    aspect: 1,
    near: 1,
    far: 100,
}) {
}

export class PerspectiveCamera extends Camera {
    readonly prop = new PerspectiveProp()
    protected override get rev() {
        return super.rev +
            this.prop.rev
    }
    protected override update() {
        const { fov, aspect, near, far } = this.prop
        mat4.perspective(this.projection, fov, aspect, near, far)
        super.update()
    }
    get fov() {
        return this.prop.fov
    }
    set fov(val) {
        this.prop.fov = val
    }
    get aspect() {
        return this.prop.aspect
    }
    set aspect(val) {
        this.prop.aspect = val
    }
    get near() {
        return this.prop.near
    }
    set near(val) {
        this.prop.near = val
    }
    get far() {
        return this.prop.far
    }
    set far(val) {
        this.prop.far = val
    }
    constructor(readonly opts?: {
        fov?: number
        aspect?: number
        near?: number
        far?: number
    } & ObjOpts) {
        const { fov = 60 * Math.PI / 180, aspect = 1, near = 1, far = 1000 } = opts || { },
            projection = mat4.perspective(mat4.create(), fov, aspect, near, far)
        super({ ...opts, projection })
        Object.assign(this.prop, { fov, aspect, near, far })
    }
}
