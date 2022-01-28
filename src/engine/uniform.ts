import { mat4, vec4 } from "gl-matrix"

export default class Uniform {
    constructor(readonly name: string, readonly values: mat4 | vec4) {
    }
}
