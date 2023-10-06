import { mat4, vec4 } from "gl-matrix"

export class Texture {
    static Usage = { ...(globalThis.GPUTextureUsage || { }) }
    constructor(readonly opts: GPUTextureDescriptor & { source?: ImageBitmap }, readonly view?: GPUTextureViewDescriptor) {
    }
}

export class Sampler {
    constructor(readonly opts = { } as GPUSamplerDescriptor) {
    }
}

export type UniformValue = mat4 | vec4 | Uint32Array | Int32Array | Float32Array | Uint16Array
export type Uniform = UniformValue[] | Texture | Sampler
