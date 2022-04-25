/// <reference path="../typing.d.ts" />

import { Color4 } from '../utils/math'
import code from './webgpu/shader.wgsl?raw'

export default class Material {
    readonly color = new Color4()

    readonly bindingGroup = 3
    readonly uniforms = {
        color: this.color.data,
    }

    private static counter = 1
    readonly id: number
    constructor(
        readonly shaders: { code: string }
    ) {
        this.id = Material.counter ++
    }

    needsUpdate() {
        return this.color.needsUpdate()
    }
    update() {
        this.color.update()
    }
}

export interface BasicMaterialOptions {
    color?: Float32Array | Uint8Array | number[],
}

export class BasicMaterial extends Material {
    constructor(opts = { } as BasicMaterialOptions) {
        super({ code })
        if (opts.color) {
            let [r, g, b, a = 1] = opts.color
            if (opts.color instanceof Uint8Array) {
                r /= 255
                g /= 255
                b /= 255
                a = opts.color.length > 3 ? opts.color[3] / 255 : 1
            }
            this.color.set(r, g, b, a)
        }
    }
}
