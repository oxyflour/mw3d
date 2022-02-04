import { mat4 } from 'gl-matrix'

import Obj3 from './obj3'
import Geometry from './geometry'
import Material from './material'
import Uniform from './uniform'

export default class Mesh extends Obj3 {
    renderOrder = 0
    isVisible = true

    private readonly matrixUniform: Uniform
    constructor(
        public geo: Geometry,
        public mat: Material,
        public uniforms = [ ] as Uniform[],
        public offset = 0,
        public count = -1,
        public mode = WebGLRenderingContext.TRIANGLES) {
        super()

        this.matrixUniform = this.uniforms.find(uniform => uniform.name === 'u_model_matrix')
        if (!this.matrixUniform) {
            this.matrixUniform = new Uniform('u_model_matrix', mat4.create())
            this.uniforms.push(this.matrixUniform)
        }

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
    protected updateMatrix() {
        super.updateMatrix()
        mat4.copy(this.matrixUniform.values as mat4, this.worldMatrix)
    }
}
