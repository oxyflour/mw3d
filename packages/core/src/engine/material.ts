/// <reference path="../typing.d.ts" />

import { vec4 } from 'gl-matrix'
import { AutoIndex } from '../utils/common'
import { MutableArray } from '../utils/math'
import { GeometryPrimitive } from './geometry'
import { Sampler, Texture, Uniform } from './uniform'
import type { MaterialDescription } from './webrtx/loader'

export type ProgramEntry = Partial<{ [k in GeometryPrimitive]: string }> | string

export class MaterialProp extends MutableArray({
    r: 1.0,
    g: 0.765557,
    b: 0.336057,
    a: 1,
    roughness: 0.1,
    metallic: 1.0,
    lineWidth: 2.0,
    emissive: 0,
}) {
    constructor(override readonly data = new Float32Array([1.0, 0.0, 0.0, 1.0, 0.1, 1.0, 2.0, 0.2])) {
        super(data)
    }
}

export class MaterialClip extends MutableArray({
    x: 0,
    y: 0,
    z: 0,
    w: 0,
}) {
    constructor(override readonly data = new Float32Array([0, 0, 0, 0])) {
        super(data)
    }
}

export interface MatOpts {
    renderOrder?: number
    texture?: Texture
    sampler?: Sampler
    webgpu?: {
        multisample?: GPUMultisampleState
        primitive?: GPUPrimitiveState
        depthStencil?: Omit<GPUDepthStencilState, 'format'>
    }
    webgl?: {
        polygonOffset?: {
            units?: number
            factor?: number
        }
    }
    webrtx?: MaterialDescription
}

export default class Material extends AutoIndex {
    readonly prop = new MaterialProp()
    readonly clip = new MaterialClip()
    get needsClip() {
        const [a, b, c] = this.clip.data
        return a || b || c
    }

    readonly bindingGroup = 3
    private static DEFAULT_SAMPLER = new Sampler({ })
    readonly uniforms = [
        [
            this.prop.data,
            this.clip.data,
        ],
        // texture
    ] as Uniform[]

    renderOrder = 0

    constructor(readonly opts: {
        wgsl?: { vert?: ProgramEntry, frag?: ProgramEntry }
        glsl?: { vert?: ProgramEntry, frag?: ProgramEntry },
    } & MatOpts) {
        super()
        if (opts.texture) {
            this.uniforms[1] = opts.texture
            this.uniforms[2] = opts.sampler || Material.DEFAULT_SAMPLER
        }
        if (opts.renderOrder !== undefined) {
            this.renderOrder = opts.renderOrder
        }
    }

    get rev() {
        return this.prop.rev + this.clip.rev
    }
}

export class BasicMaterial extends Material {
    constructor(opts = { } as {
        wgsl?: { vert?: ProgramEntry, frag?: ProgramEntry },
        glsl?: { vert?: ProgramEntry, frag?: ProgramEntry },
        rtx?: MaterialDescription,
        color?: Float32Array | Uint8Array | number[]
        clipPlane?: vec4 | number[]
    } & Partial<MaterialProp> & MatOpts) {
        super(opts)
        let [r = Math.random(), g = Math.random(), b = Math.random(), a = 1] = opts.color || []
        if (opts.color instanceof Uint8Array) {
            r /= 255
            g /= 255
            b /= 255
            a = opts.color.length > 3 ? a / 255 : 1
        }
        Object.assign(this.prop, { r, g, b, a })
        Object.assign(this.prop, opts)
        if (opts.clipPlane) {
            this.clip.assign(opts.clipPlane)
        }
    }
}
