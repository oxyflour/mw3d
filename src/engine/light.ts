import { vec4 } from 'gl-matrix'

import Obj3 from './obj3'
import { Uniform } from './uniform'

export default class Light extends Obj3 {
    readonly bindingGroup = 1
    readonly lightDirection = vec4.create()
    readonly uniforms = {
        lightDirection: {
            value: this.lightDirection,
            binding: 0,
            offset: 0,
        } as Uniform,
    }
}

export class DirectionalLight extends Light {
    readonly direction = vec4.create()
    readonly directionUniform: Uniform
    constructor(readonly opts: { direction?: number[], intensity?: number }) {
        super()
        const [x, y, z] = opts.direction || [0, 0, 1],
            r = opts.intensity === undefined ? 1 : opts.intensity
        vec4.set(this.direction, x, y, z, r)
    }
    protected updateMatrix() {
        super.updateMatrix()
        vec4.transformMat4(this.lightDirection, this.direction, this.worldMatrix)
        this.lightDirection.values[3] = this.direction[3]
    }
}
