import { mat4, quat, vec3 } from 'gl-matrix'
import { Vec3, Quat } from '../utils/math'

export default class Obj3 {
    position = vec3.create()
    rotation = quat.create()
    scale = vec3.fromValues(1, 1, 1)

    // for external uses only
    pos = new Vec3(this.position)
    rot = new Quat(this.rotation)
    scl = new Vec3(this.scale)

    private parent?: Obj3
    readonly children = new Set<Obj3>()
    add(child: Obj3) {
        child.addTo(this)
    }
    remove(child: Obj3) {
        this.children.delete(child)
        if (child.parent === this) {
            child.parent = undefined
        }
    }
    addTo(parent: Obj3) {
        if (this.parent) {
            this.parent.children.delete(this)
        }
        if (this.parent = parent) {
            this.parent.children.add(this)
        }
    }
    getParent() {
        return this.parent
    }

    private cachedParent?: Obj3
    private cachedStatus = { position: vec3.create(), rotation: quat.create(), scale: vec3.create() }
    readonly worldMatrix = mat4.create()
    protected needsUpdate() {
        return this.cachedParent !== this.parent ||
            !vec3.exactEquals(this.position, this.cachedStatus.position) ||
            !quat.exactEquals(this.rotation, this.cachedStatus.rotation) ||
            !vec3.exactEquals(this.scale, this.cachedStatus.scale)
    }
    protected updateMatrix() {
        const { rotation, position, scale } = this.cachedStatus
        mat4.fromRotationTranslationScale(
            this.worldMatrix,
            quat.copy(rotation, this.rotation),
            vec3.copy(position, this.position),
            vec3.copy(scale, this.scale))
        if (this.cachedParent = this.parent) {
            mat4.multiply(this.worldMatrix, this.cachedParent.worldMatrix, this.worldMatrix)
        }
        for (const child of this.children) {
            child.updateMatrix()
        }
    }
    updateIfNecessary() {
        if (this.needsUpdate()) {
            this.updateMatrix()
        } else {
            for (const child of this.children) {
                child.updateIfNecessary()
            }
        }
    }

    private static counter = 0
    readonly id: number
    constructor() {
        this.id = Obj3.counter ++
    }
    clone() {
        const cloned = new (this as any).contructor() as this
        cloned.position = vec3.clone(this.position)
        cloned.rotation = quat.clone(this.rotation)
        cloned.scale = vec3.clone(this.scale)
        if (this.parent) {
            cloned.addTo(this.parent)
        }
    }
    dispose() {
        if (this.parent) {
            this.parent.remove(this)
        }
        // TODO
    }
    walk(func: (obj: Obj3) => void) {
        func(this)
        for (const child of this.children) {
            child.walk(func)
        }
    }
}
