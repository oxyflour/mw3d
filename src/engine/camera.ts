import { mat4 } from 'gl-matrix'

import Obj3 from './obj3'
import { Uniform } from './uniform'

export default class Camera extends Obj3 {
    private viewProjection = mat4.create()
    private viewMatrix = mat4.create()

    readonly bindingGroup = 0
    readonly uniforms = {
        viewProjection: {
            value: this.viewProjection,
            binding: 0,
            offset: 0,
        } as Uniform,
    }

    protected update() {
        super.update()
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
        return super.needsUpdate()  ||
            fov     !== this.fov    ||
            aspect  !== this.aspect ||
            near    !== this.near   ||
            far     !== this.far
    }
    protected update() {
        super.update()
        const { fov, aspect, near, far } = this
        mat4.perspective(this.projection, fov, aspect, near, far)
        Object.assign(this.cachedPerspectiveParams, { fov, aspect, near, far })
    }
    constructor(public fov: number, public aspect: number, public near: number, public far: number) {
        super(mat4.perspective(mat4.create(), fov, aspect, near, far))
        Object.assign(this.cachedPerspectiveParams, { fov, aspect, near, far })
    }
}
