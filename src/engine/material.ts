/// <reference path="../typing.d.ts" />

import { defineArrayProp, Mutable } from '../utils/math'
import { Texture } from './uniform'
import code from './webgpu/shader.wgsl?raw'

export type ProgramEntry = { [k in GPUPrimitiveTopology]: string }
export default class Material extends Mutable {
    readonly prop = defineArrayProp({
        r: 1.0,
        g: 0.765557,
        b: 0.336057,
        a: 1,
        roughness: 0.1,
        metallic: 1.0,
    })

    readonly bindingGroup = 3
    readonly uniforms = [
        [
            this.prop.data
        ]
    ]

    private static counter = 1
    readonly id: number
    constructor(readonly opts: {
        code: string
        entry: { vert: string | ProgramEntry, frag: string | ProgramEntry }
    }) {
        super()
        this.id = Material.counter ++
    }

    updateIfNecessary(updated?: (obj: Material) => void) {
        if (this.needsUpdate()) {
            this.update()
            updated?.(this)
        }
    }
    protected needsUpdate() {
        return this.isDirty ||
            // @ts-ignore
            this.prop.needsUpdate()
    }
    protected update() {
        super.update()
        // @ts-ignore
        this.prop.update()
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
        entry?: { vert?: string | ProgramEntry, frag?: string | ProgramEntry },
        color?: Float32Array | Uint8Array | number[]
        roughness?: number
        metallic?: number
    }) {
        const entry = BasicMaterial.defaultEntry,
            { vert = entry.vert, frag = entry.frag } = opts.entry || { }
        super({ code, entry: { vert, frag } })
        if (opts.color) {
            let [r, g, b, a = 1] = opts.color
            if (opts.color instanceof Uint8Array) {
                r /= 255
                g /= 255
                b /= 255
                a = opts.color.length > 3 ? opts.color[3] / 255 : 1
            }
            Object.assign(this.prop, { r, g, b, a })
        }
        opts.roughness && (this.prop.roughness = opts.roughness)
        opts.metallic && (this.prop.metallic = opts.metallic)
    }
}
