/// <reference path="../typing.d.ts" />

import { vec4 } from 'gl-matrix'

import vertShader from './webgl2/shader/vert.glsl?raw'
import fragShader from './webgl2/shader/frag.glsl?raw'
import { Uniform } from './uniform'
import { format } from '../utils/common'

export class Program {
    private static counter = 1
    readonly id: number
    constructor(
            readonly glsl: { type: number, src: string }[],
            readonly wgsl: { vert: string, frag: string },
        ) {
        this.id = Program.counter ++
    }
}

export default class Material {
    private static counter = 1
    readonly id: number
    constructor(
        readonly prog: Program,
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
    static cachedPrograms = { } as { [src: string]: Program }
    constructor(opts = { } as BasicMaterialOptions) {
        if (opts.vertexColor && !opts.vertexColorAttr) opts.vertexColorAttr = 'a_color'
        if (opts.vertexNormal && !opts.vertexNormalAttr) opts.vertexNormalAttr = 'a_normal'
        const vertSrc = format(vertShader, { opts }),
            fragSrc = format(fragShader, { opts }),
            cache = BasicMaterial.cachedPrograms,
            key = `${vertSrc}###${fragSrc}`,
            prog = cache[key] || (cache[key] = new Program([{
                type: WebGL2RenderingContext.VERTEX_SHADER,
                src: vertSrc
            }, {
                type: WebGL2RenderingContext.FRAGMENT_SHADER,
                src: fragSrc
            }], {
                vert: vertShader,
                frag: fragShader,
            })),
            uniforms = [ ] as Uniform[]
        if (opts.color) {
            let [r, g, b, a = 1] = opts.color
            if (opts.color instanceof Uint8Array) {
                r /= 255
                g /= 255
                b /= 255
                a = opts.color.length > 3 ? opts.color[3] / 255 : 1
            }
            uniforms.push({
                name: 'u_color',
                type: 'vec4',
                values: vec4.fromValues(r, g, b, a)
            })
        }
        super(prog, uniforms)
    }
}
