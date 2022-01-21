import { mat4, vec4 } from "gl-matrix"

export type Uniform = { name: string } & ({
    type: 'mat4'
    values: mat4
} | {
    type: 'vec4'
    values: vec4
})
