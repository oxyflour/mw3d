import { mat4, vec4 } from 'gl-matrix'

import Obj3 from './obj3'
import Geometry from './geometry'
import Material from './material'
import { Uniform } from './uniform'

export default class Mesh extends Obj3 {
    private modelMatrix = mat4.create()

    readonly bindingGroup = 2
    readonly uniforms = {
        modelMatrix: {
            value: this.modelMatrix,
            binding: 0,
            offset: 0,
        } as Uniform
    }

    renderOrder = 0
    isVisible = true
    readonly center = vec4.fromValues(0, 0, 0, 0)

    private readonly matrixUniform: Uniform
    constructor(
        public geo: Geometry,
        public mat: Material,
        public offset = 0,
        public count = -1) {
        super()
    }
    protected update() {
        super.update()
        mat4.copy(this.modelMatrix, this.worldMatrix)
        vec4.transformMat4(this.center, this.geo.center, this.modelMatrix)
    }
}
