import { mat4, vec4 } from "gl-matrix"

export type UniformValue = mat4 | vec4 | Uint32Array | Int32Array
export type UniformDefine = {
    value: UniformValue
    binding?: number
    order?: number
}
export type Uniform = UniformValue | UniformDefine
