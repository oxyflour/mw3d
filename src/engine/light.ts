import { mat4, vec4 } from 'gl-matrix'
import Obj3 from './obj3'
import { Uniform } from './renderer'

export default class Light extends Obj3 {
	readonly uniforms = [] as Uniform[]
}

export class DirectionalLight extends Light {
	readonly direction = vec4.create()
	readonly uniformDirection = vec4.create()
	readonly uniforms = [{ name: 'u_light_direction', type: 'vec4' as 'vec4', values: this.uniformDirection }]
	constructor(readonly opts: { direction?: number[], intensity?: number }) {
		super()
		const [x, y, z] = opts.direction || [0, 0, 1],
			r = opts.intensity === undefined ? 1 : opts.intensity
		this.direction.set([x, y, z, r])
	}
    protected updateMatrix() {
		super.updateMatrix()
		vec4.transformMat4(this.uniformDirection, this.direction, this.worldMatrix)
		this.uniformDirection[3] = this.direction[3]
	}
}
