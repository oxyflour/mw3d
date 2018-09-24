import Program from './program'
import { Uniform } from './renderer'
import { vec4 } from 'gl-matrix'

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
}

export class BasicMaterial extends Material {
    static readonly makeVertexShader = (opts: BasicMaterialOptions) => `#version 300 es
        in vec4 a_position;

        ${opts.vertexColorAttr ? `
        in vec4 ${opts.vertexColorAttr};
        ` : ''}

        uniform mat4 u_view_proj;
        uniform mat4 u_model_matrix;
        
        ${opts.vertexColorAttr ? `
        out vec4 v_color;
        ` : ''}
        
        void main() {
            gl_Position = u_view_proj * u_model_matrix * a_position;

            ${opts.vertexColorAttr ? `
            v_color = ${opts.vertexColorAttr};
            ` : ''}
        }
    `
    static readonly makeFragmentShader = (opts: BasicMaterialOptions) => `#version 300 es
        precision mediump float;
        
        ${opts.color ? `
        uniform vec4 u_color;
        ` : ''}

        ${opts.vertexColorAttr ? `
        in vec4 v_color;
        ` : ''}
        
        out vec4 outColor;
        
        void main() {
            ${opts.color ? `
            outColor = u_color;
            ` : opts.vertexColorAttr ? `
            outColor = v_color;
            ` : `
            outColor = vec4(1., 0., 0., 1.);
            `}
        }
    `

    static cachedPrograms = { } as { [src: string]: Program }
    constructor(opts = { } as BasicMaterialOptions) {
        const src = [BasicMaterial.makeVertexShader(opts), BasicMaterial.makeFragmentShader(opts)],
            cache = BasicMaterial.cachedPrograms,
            key = src.join('###'),
            prog = cache[key] || (cache[key] = new Program([{
                type: WebGL2RenderingContext.VERTEX_SHADER,
                src: src[0]
            }, {
                type: WebGL2RenderingContext.FRAGMENT_SHADER,
                src: src[1]
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
