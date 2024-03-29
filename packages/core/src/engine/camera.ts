import { mat4, vec3 } from 'gl-matrix'
import { MutableArray } from '../utils/math'

import Obj3, { ObjOpts } from './obj3'

const DEPTH_RANGE_REMAP = mat4.create()
DEPTH_RANGE_REMAP[10] = -1
DEPTH_RANGE_REMAP[14] = 1

export default class Camera extends Obj3 {
    readonly viewProjection = mat4.create()
    readonly invWorldMatrix = mat4.create()

    readonly bindingGroup = 1
    readonly uniforms = [
        [
            this.viewProjection,
            this.worldPosition,
            this.worldMatrix,
        ]
    ]

    protected override update() {
        super.update()
        mat4.invert(this.invWorldMatrix, this.worldMatrix)
        mat4.multiply(this.viewProjection, this.projection, this.invWorldMatrix)
        mat4.multiply(this.viewProjection, DEPTH_RANGE_REMAP, this.viewProjection)
    }
    readonly projection: mat4
    constructor(opts?: {
        projection?: mat4
    } & ObjOpts) {
        super(opts)
        this.projection = opts?.projection || mat4.create()
    }
}

export class PerspectiveProp extends MutableArray({
    fov: 30 * Math.PI / 180,
    aspect: 1,
    near: 1,
    far: Infinity,
}) {
}

export class PerspectiveCamera extends Camera {
    readonly prop = new PerspectiveProp()
    override get rev() {
        return super.rev +
            this.prop.rev
    }
    protected override update() {
        const { fov, aspect, near, far } = this.prop
        mat4.perspectiveZO(this.projection, fov, aspect, near, far)
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
        const { fov = 60 * Math.PI / 180, aspect = 1, near = 1, far = Infinity } = opts || { },
            projection = mat4.perspectiveZO(mat4.create(), fov, aspect, near, far)
        super({ ...opts, projection })
        Object.assign(this.prop, { fov, aspect, near, far })
    }
    /**
     * Note: remember to update camera first
     */
    getWorldDirFromNDC(out: vec3) {
        vec3.set(out, out[0], out[1], -1)
        vec3.transformMat4(out, out, this.worldMatrix)
        vec3.sub(out, out, this.worldPosition as vec3)
        vec3.normalize(out, out)
        return out
    }
}

Object.assign(Camera, { PerspectiveCamera })
