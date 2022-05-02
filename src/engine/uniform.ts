import { mat4, vec4 } from "gl-matrix"

export class Texture {
    constructor(readonly opts: GPUTextureDescriptor) {
    }
}

export class Sampler {
    constructor(readonly opts: GPUSamplerDescriptor) {
    }
}

export type UniformValue = mat4 | vec4 | Uint32Array | Int32Array
export type Uniform = UniformValue[] | Texture | Sampler
