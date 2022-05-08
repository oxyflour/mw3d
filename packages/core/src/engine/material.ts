/// <reference path="../typing.d.ts" />

import { AutoIndex } from '../utils/common'
import { MutableArray } from '../utils/math'
import { Sampler, Texture, Uniform } from './uniform'
import code from './webgpu/shader.wgsl?raw'

export type ProgramEntry = { [k in GPUPrimitiveTopology]: string } | string

export class MaterialProp extends MutableArray({
    r: 1.0,
    g: 0.765557,
    b: 0.336057,
    a: 1,
    roughness: 0.1,
    metallic: 1.0,
}) {
    constructor(readonly data = new Float32Array(6)) {
        super(data)
    }
}

export default class Material extends AutoIndex {
    prop = new MaterialProp()

    readonly bindingGroup = 3
    private static DEFAULT_SAMPLER = new Sampler({ })
    readonly uniforms = [
        [this.prop.data],
        // texture
    ] as Uniform[]

    constructor(readonly opts: {
        code: string
        entry: { vert: ProgramEntry, frag: ProgramEntry }
        texture?: Texture
        sampler?: Sampler
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
        texture?: Texture
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
    }
}
