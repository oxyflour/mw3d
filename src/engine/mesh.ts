import Obj3 from './obj3'
import Geometry from './geometry'
import Material from './material'
import { mat4 } from 'gl-matrix'
import { Uniform } from './uniform'

export default class Mesh extends Obj3 {
    renderOrder = 0
    private readonly matrixUniform: Uniform
    constructor(
        public geo: Geometry,
        public mat: Material,
        public uniforms = [ ] as Uniform[],
        public start = 0,
        public count = -1,
        public mode = WebGLRenderingContext.TRIANGLES) {
        super()

        this.matrixUniform = this.uniforms.find(uniform => uniform.name === 'u_model_matrix')
        if (!this.matrixUniform) {
            this.matrixUniform = {
                name: 'u_model_matrix',
                type: 'mat4',
                values: mat4.create()
            }
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
        this.matrixUniform.values = this.worldMatrix
    }
}
