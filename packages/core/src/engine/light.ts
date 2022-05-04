import Obj3 from './obj3'

export default class Light extends Obj3 {
    readonly bindingGroup = 0
    readonly uniforms = [
        [
            this.worldPosition
        ]
    ]
}
