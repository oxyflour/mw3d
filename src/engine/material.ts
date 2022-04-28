/// <reference path="../typing.d.ts" />

import { defineArrayProp } from '../utils/math'
import code from './webgpu/shader.wgsl?raw'

export default class Material {
    readonly prop = defineArrayProp({
        r: 0,
        g: 1,
        b: 2,
        a: 3,
        roughness: 4,
        metallic: 5
    }, new Float32Array([1.0, 0.765557, 0.336057, 1, 0.1, 1.0]))

    readonly bindingGroup = 3
    readonly uniforms = [
        this.prop.data
    ]

    private static counter = 1
    readonly id: number
    constructor(
        readonly shaders: { code: string }
    ) {
        this.id = Material.counter ++
    }

    needsUpdate() {
        return this.prop.needsUpdate()
    }
    update() {
        this.prop.update()
    }
}

export class BasicMaterial extends Material {
    constructor(opts = { } as {
        color?: Float32Array | Uint8Array | number[]
        roughness?: number
        metallic?: number
    }) {
        super({ code })
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
