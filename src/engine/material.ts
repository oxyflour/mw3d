/// <reference path="../typing.d.ts" />

import { vec4 } from 'gl-matrix'

import Program from './program'
import { Uniform } from './renderer'

import vertShader from './shader/vert.glsl?raw'
import fragShader from './shader/frag.glsl?raw'

export default class Material {
    private static counter = 1
    readonly id: number
    constructor(
        readonly prog: Program,
        public uniforms = [ ] as Uniform[],
    ) {
        this.id = Material.counter ++
    }
    clone() {
        const { prog, uniforms } = this
        return new (this as any).constructor(prog, JSON.parse(JSON.stringify(uniforms)))
    }
    dispose() {
        // TODO
    }
}

export interface BasicMaterialOptions {
    color?: Float32Array | Uint8Array | number[],
    vertexColorAttr?: string
    vertexNormalAttr?: string
}

export class BasicMaterial extends Material {
    static makeShader(src: string, opts: BasicMaterialOptions) {
        const replaced = src.replace(/\/\/\$/g, '$').replace(/\/\/`/g, '`'),
            func = new Function('opts', `return \`${replaced}\``)
        return func(opts)
    }

    static cachedPrograms = { } as { [src: string]: Program }
    constructor(opts = { } as BasicMaterialOptions) {
        const vertSrc = BasicMaterial.makeShader(vertShader, opts),
            fragSrc = BasicMaterial.makeShader(fragShader, opts),
            cache = BasicMaterial.cachedPrograms,
            key = `${vertSrc}###${fragSrc}`,
            prog = cache[key] || (cache[key] = new Program([{
                type: WebGL2RenderingContext.VERTEX_SHADER,
                src: vertSrc
            }, {
                type: WebGL2RenderingContext.FRAGMENT_SHADER,
                src: fragSrc
            }])),
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
