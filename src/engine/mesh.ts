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

        if (this.count < 0) {
            if (geo.indices) {
                this.count = geo.indices.length
            } else {
                const positions = geo.attrs.find(item => item.name === 'a_position')
                if (positions && positions.values) {
                    this.count = (positions.values as ArrayLike<any>).length / 3
                }
            }
        }
    }
    protected update() {
        super.update()
        mat4.copy(this.modelMatrix, this.worldMatrix)
        vec4.transformMat4(this.center, this.geo.center, this.modelMatrix)
    }
}
