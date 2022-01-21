import { vec4 } from 'gl-matrix'

import Obj3 from './obj3'
import { Uniform } from './uniform'

export default class Light extends Obj3 {
	readonly uniforms = [] as Uniform[]
}

export class DirectionalLight extends Light {
	readonly direction = vec4.create()
	readonly directionUniform: Uniform
	constructor(readonly opts: { direction?: number[], intensity?: number }) {
		super()
		const [x, y, z] = opts.direction || [0, 0, 1],
			r = opts.intensity === undefined ? 1 : opts.intensity
		this.direction.set([x, y, z, r])
		this.directionUniform = this.uniforms.find(uniform => uniform.name === 'u_light_direction')
		if (!this.directionUniform) {
			this.directionUniform = {
				name: 'u_light_direction',
				type: 'vec4' as 'vec4',
				values: vec4.create()
			}
			this.uniforms.push(this.directionUniform)
		}
	}
    protected updateMatrix() {
		super.updateMatrix()
		vec4.transformMat4(this.directionUniform.values as vec4, this.direction, this.worldMatrix)
		this.directionUniform.values[3] = this.direction[3]
	}
}
