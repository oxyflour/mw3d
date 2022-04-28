import { vec4 } from 'gl-matrix'

import Obj3 from './obj3'

export default class Light extends Obj3 {
    readonly bindingGroup = 1
    readonly lightDirection = vec4.create()
    readonly uniforms = [
        this.lightDirection,
        this.worldPosition
    ]
}

export class DirectionalLight extends Light {
    readonly direction = vec4.create()
    constructor(readonly opts: { direction?: number[], intensity?: number }) {
        super()
        const [x, y, z] = opts.direction || [0, 0, 1],
            r = opts.intensity === undefined ? 1 : opts.intensity
        vec4.set(this.direction, x, y, z, r)
    }
    protected update() {
        super.update()
        vec4.transformMat4(this.lightDirection, this.direction, this.worldMatrix)
        this.lightDirection.values[3] = this.direction[3]
    }
}
