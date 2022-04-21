/// <reference path="../typing.d.ts" />

import { vec4 } from 'gl-matrix'
import { Uniform } from './uniform'
import wgslShader from './webgpu/shader.wgsl?raw'

export default class Material {
    readonly color = vec4.create()

    readonly bindingGroup = 3
    readonly uniforms = {
        color: {
            value: this.color,
            binding: 0,
            offset: 0,
        } as Uniform
    }

    private static counter = 1
    readonly id: number
    constructor(
        readonly shaders: {
            glsl?: { type: number, src: string }[],
            wgsl?: string,
        }
    ) {
        this.id = Material.counter ++
    }
}

export interface BasicMaterialOptions {
    color?: Float32Array | Uint8Array | number[],
}

export class BasicMaterial extends Material {
    constructor(opts = { } as BasicMaterialOptions) {
        super({ wgsl: wgslShader })
        if (opts.color) {
            let [r, g, b, a = 1] = opts.color
            if (opts.color instanceof Uint8Array) {
                r /= 255
                g /= 255
                b /= 255
                a = opts.color.length > 3 ? opts.color[3] / 255 : 1
            }
            vec4.set(this.color, r, g, b, a)
        }
    }
}
