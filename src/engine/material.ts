/// <reference path="../typing.d.ts" />

import { vec4 } from 'gl-matrix'

import Uniform from './uniform'
import { format } from '../utils/common'

import wgslVertShader from './webgpu/shader/vert.wgsl?raw'
import wgslFragShader from './webgpu/shader/frag.wgsl?raw'
import glslVertShader from './webgl2/shader/vert.glsl?raw'
import glslFragShader from './webgl2/shader/frag.glsl?raw'

export default class Material {
    private static counter = 1
    readonly id: number
    constructor(
        readonly shaders: {
            glsl?: { type: number, src: string }[],
            wgsl?: { vert: string, frag: string },
        },
        public uniforms = [ ] as Uniform[],
    ) {
        this.id = Material.counter ++
    }
}

export interface BasicMaterialOptions {
    color?: Float32Array | Uint8Array | number[],
    vertexColor?: boolean
    vertexColorAttr?: string
    vertexNormal?: boolean
    vertexNormalAttr?: string
}

export class BasicMaterial extends Material {
    constructor(opts = { } as BasicMaterialOptions) {
        if (opts.vertexColor && !opts.vertexColorAttr) opts.vertexColorAttr = 'a_color'
        if (opts.vertexNormal && !opts.vertexNormalAttr) opts.vertexNormalAttr = 'a_normal'
        const vertSrc = format(glslVertShader, { opts }),
            fragSrc = format(glslFragShader, { opts }),
            shaders = {
                glsl: [{
                    type: WebGL2RenderingContext.VERTEX_SHADER,
                    src: vertSrc
                }, {
                    type: WebGL2RenderingContext.FRAGMENT_SHADER,
                    src: fragSrc
                }],
                wgsl: {
                    vert: wgslVertShader,
                    frag: wgslFragShader,
                }
            },
            uniforms = [ ] as Uniform[]
        if (opts.color) {
            let [r, g, b, a = 1] = opts.color
            if (opts.color instanceof Uint8Array) {
                r /= 255
                g /= 255
                b /= 255
                a = opts.color.length > 3 ? opts.color[3] / 255 : 1
            }
            uniforms.push(new Uniform('u_color', vec4.fromValues(r, g, b, a)))
        }
        super(shaders, uniforms)
    }
}
