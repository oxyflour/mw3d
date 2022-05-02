import { mat4 } from 'gl-matrix'

import Obj3 from './obj3'

export default class Camera extends Obj3 {
    private viewProjection = mat4.create()
    private viewMatrix = mat4.create()

    readonly bindingGroup = 1
    readonly uniforms = [
        this.viewProjection,
        this.worldPosition,
    ]

    protected update() {
        super.update()
        mat4.invert(this.viewMatrix, this.worldMatrix)
        mat4.multiply(this.viewProjection, this.projection, this.viewMatrix)
    }
    constructor(readonly projection = mat4.create()) {
        super()
    }
}

export class PerspectiveCamera extends Camera {
    readonly cachedPerspectiveParams: { fov: number, aspect: number, near: number, far: number }
    protected needsUpdate() {
        const cache = this.cachedPerspectiveParams
        return super.needsUpdate()  ||
            cache.fov     !== this.fov    ||
            cache.aspect  !== this.aspect ||
            cache.near    !== this.near   ||
            cache.far     !== this.far
    }
    protected update() {
        const { fov, aspect, near, far } = this
        mat4.perspective(this.projection, fov, aspect, near, far)
        Object.assign(this.cachedPerspectiveParams, { fov, aspect, near, far })
        super.update()
    }
    constructor(public fov: number, public aspect: number, public near: number, public far: number) {
        super(mat4.perspective(mat4.create(), fov, aspect, near, far))
        this.cachedPerspectiveParams = { fov, aspect, near, far }
    }
}
