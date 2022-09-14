/// <reference path="../typing.d.ts" />

import { vec4 } from 'gl-matrix'
import { AutoIndex } from '../utils/common'
import { MutableArray } from '../utils/math'
import { Sampler, Texture, Uniform } from './uniform'
import wgsl from './webgpu/shader.wgsl?raw'

// Note: wgsl global const not yet supported
const code = (wgsl + '').replace(/\r\n/g, '\n').replace(/\/\/ @replace-let-with-const\nlet /g, 'const ')

export type ProgramEntry = { [k in GPUPrimitiveTopology]: string } | string

export class MaterialProp extends MutableArray({
    r: 1.0,
    g: 0.765557,
    b: 0.336057,
    a: 1,
    roughness: 0.1,
    metallic: 1.0,
    x: 0,
    y: 0,
}) {
    constructor(readonly data = new Float32Array(8)) {
        super(data)
    }
}

export default class Material extends AutoIndex {
    prop = new MaterialProp()
    readonly clipPlane = vec4.fromValues(0, 0, 0, 0)
    get needsClip() {
        const [a, b, c, d] = this.clipPlane
        return a || b || c || d
    }

    readonly bindingGroup = 3
    private static DEFAULT_SAMPLER = new Sampler({ })
    readonly uniforms = [
        [
            this.prop.data,
            this.clipPlane,
        ],
        // texture
    ] as Uniform[]

    constructor(readonly opts: {
        code: string
        entry: { vert: ProgramEntry, frag: ProgramEntry }
        texture?: Texture
        sampler?: Sampler
        depth?: {
            bias?: number
        }
    }) {
        super()
        if (opts.texture) {
            this.uniforms.push(
                opts.texture,
                opts.sampler || Material.DEFAULT_SAMPLER
            )
        }
    }

    get rev() {
        return this.prop.rev
    }
}

export class BasicMaterial extends Material {
    static defaultEntry = {
        vert: 'vertMain',
        frag: {
            'point-list': 'fragMainColor',
            'line-list': 'fragMainColor',
            'line-strip': 'fragMainColor',
            'triangle-list': 'fragMain',
            'triangle-strip': 'fragMain',
        } as ProgramEntry
    }
    constructor(opts = { } as {
        entry?: { vert?: ProgramEntry, frag?: ProgramEntry },
        color?: Float32Array | Uint8Array | number[]
        roughness?: number
        metallic?: number
        clipPlane?: vec4 | number[]
        texture?: Texture
        sampler?: Sampler
        depth?: {
            bias?: number
        }
    }) {
        const entry = BasicMaterial.defaultEntry,
            { vert = entry.vert, frag = entry.frag } = opts.entry || { }
        super({ ...opts, code, entry: { vert, frag } })
        let [r = Math.random(), g = Math.random(), b = Math.random(), a = 1] = opts.color || []
        if (opts.color instanceof Uint8Array) {
            r /= 255
            g /= 255
            b /= 255
            a = opts.color.length > 3 ? a / 255 : 1
        }
        Object.assign(this.prop, { r, g, b, a })
        opts.roughness && (this.prop.roughness = opts.roughness)
        opts.metallic && (this.prop.metallic = opts.metallic)
        if (opts.clipPlane) {
            const [a = 0, b = 0, c = 0, d = 0] = opts.clipPlane
            vec4.set(this.clipPlane, a, b, c, d)
        }
    }
}
