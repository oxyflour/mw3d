import { mat4 } from 'gl-matrix'

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

export class PerspectiveCamera extends Camera {
    readonly cachedPerspectiveParams: { fov: number, aspect: number, near: number, far: number }
    protected override needsUpdate() {
        const cache = this.cachedPerspectiveParams
        return super.needsUpdate()  ||
            cache.fov     !== this.fov    ||
            cache.aspect  !== this.aspect ||
            cache.near    !== this.near   ||
            cache.far     !== this.far
    }
    protected override update() {
        const { fov, aspect, near, far } = this
        mat4.perspective(this.projection, fov, aspect, near, far)
        Object.assign(this.cachedPerspectiveParams, { fov, aspect, near, far })
        super.update()
    }
    public fov: number
    public aspect: number
    public near: number
    public far: number
    constructor(readonly opts?: {
        fov?: number
        aspect?: number
        near?: number
        far?: number
    } & ObjOpts) {
        const { fov = 60 * Math.PI / 180, aspect = 1, near = 1, far = 1000 } = opts || { },
            projection = mat4.perspective(mat4.create(), fov, aspect, near, far)
        super({ ...opts, projection })
        this.fov = fov
        this.aspect = aspect
        this.near = near
        this.far = far
        this.cachedPerspectiveParams = { fov, aspect, near, far }
    }
}
