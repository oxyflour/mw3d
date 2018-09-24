import { mat4 } from 'gl-matrix'

import Obj3 from './obj3'

export default class Camera extends Obj3 {
    private viewMatrix = mat4.create()
    private viewProjection = mat4.create()
    readonly uniforms = [{ name: 'u_view_proj', type: 'mat4' as 'mat4', values: this.viewProjection }]
    protected updateMatrix() {
        super.updateMatrix()
        mat4.invert(this.viewMatrix, this.worldMatrix)
        mat4.multiply(this.viewProjection, this.projection, this.viewMatrix)
    }
    constructor(readonly projection: mat4) {
        super()
    }
}

export class PerspectiveCamera extends Camera {
    cachedPerspectiveParams = { fov: 30, aspect: 1, near: 1, far: 1000 }
    protected needsUpdate() {
        const { fov, aspect, near, far } = this.cachedPerspectiveParams
        return super.needsUpdate() ||
            fov     !== this.fov    ||
            aspect  !== this.aspect ||
            near    !== this.near   ||
            far     !== this.far
    }
    protected updateMatrix() {
        super.updateMatrix()
        const { fov, aspect, near, far } = this
        mat4.perspective(this.projection, fov, aspect, near, far)
        Object.assign(this.cachedPerspectiveParams, { fov, aspect, near, far })
    }
    constructor(public fov: number, public aspect: number, public near: number, public far: number) {
        super(mat4.perspective(mat4.create(), fov, aspect, near, far))
        Object.assign(this.cachedPerspectiveParams, { fov, aspect, near, far })
    }
}
