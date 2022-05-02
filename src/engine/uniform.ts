import { mat4, vec4 } from "gl-matrix"

export class Texture {
    constructor(readonly opts: GPUTextureDescriptor) {
    }
}

export class Sampler {
    constructor(readonly opts: GPUSamplerDescriptor) {
    }
}

export type UniformValue = mat4 | vec4 | Uint32Array | Int32Array | Texture | Sampler
export type UniformDefine = {
    value: UniformValue
    binding?: number
    order?: number
}
export type Uniform = UniformValue | UniformDefine
