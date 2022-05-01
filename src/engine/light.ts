import { vec4 } from 'gl-matrix'

import Obj3 from './obj3'

export default class Light extends Obj3 {
    readonly bindingGroup = 1
    readonly uniforms = [
        this.worldPosition
    ]
}
