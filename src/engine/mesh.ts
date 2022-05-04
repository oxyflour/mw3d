import { mat4, vec4 } from 'gl-matrix'

import Obj3 from './obj3'
import Geometry from './geometry'
import Material from './material'

export default class Mesh extends Obj3 {
    private modelMatrix = mat4.create()

    readonly bindingGroup = 2
    readonly uniforms = [
        [
            this.modelMatrix,
            this.worldPosition,
        ]
    ]

    renderOrder = 0
    isVisible = true
    readonly center = vec4.fromValues(0, 0, 0, 0)

    constructor(
        public geo: Geometry,
        public mat: Material,
        public offset = 0,
        public count = -1) {
        super()
    }
    protected override update() {
        super.update()
        mat4.copy(this.modelMatrix, this.worldMatrix)
        vec4.transformMat4(this.center, this.geo.center, this.modelMatrix)
    }
}
