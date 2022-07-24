import { mat4, vec4 } from 'gl-matrix'

import Obj3, { ObjOpts } from './obj3'
import Geometry from './geometry'
import Material from './material'

export default class Mesh extends Obj3 {
    private modelMatrix = mat4.create()
    readonly clipPlane = vec4.fromValues(0, 0, 0, 0)

    readonly bindingGroup = 2
    readonly uniforms = [
        [
            this.modelMatrix,
            this.worldPosition,
            this.clipPlane,
        ]
    ]

    renderOrder = 0
    isVisible = true
    readonly center = vec4.fromValues(0, 0, 0, 0)

    public count = -1
    public offset = 0
    constructor(
        public geo: Geometry,
        public mat: Material,
        readonly opts?: {
            offset?: number
            count?: number
        } & ObjOpts) {
        super(opts)
        this.offset = opts?.offset !== undefined ? opts.offset : 0
        this.count = opts?.count !== undefined ? opts.count : -1
    }
    protected override update() {
        super.update()
        mat4.copy(this.modelMatrix, this.worldMatrix)
        vec4.transformMat4(this.center, this.geo.center, this.modelMatrix)
    }
}
