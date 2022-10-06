import { mat4, vec4 } from "gl-matrix"

export class Texture {
    static Usage = { ...(globalThis.GPUTextureUsage || { }) }
    constructor(readonly opts: GPUTextureDescriptor & { source?: ImageBitmap }, readonly view?: GPUTextureViewDescriptor) {
    }
}

export class Sampler {
    constructor(readonly opts: GPUSamplerDescriptor) {
    }
}

export type UniformValue = mat4 | vec4 | Uint32Array | Int32Array
export type Uniform = UniformValue[] | Texture | Sampler
