import { mat4, quat, vec3 } from 'gl-matrix'
import { Vec3, Quat } from '../utils/math'

export default class Obj3 {
    private pos = vec3.create()
    private rot = quat.create()
    private scl = vec3.fromValues(1, 1, 1)

    readonly position = new Vec3(this.pos)
    readonly rotation = new Quat(this.rot)
    readonly scaling = new Vec3(this.scl)

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

    private cachedStatus = {
        parent: null as Obj3 | null,
        pos: vec3.create(),
        rot: quat.create(),
        scl: vec3.create(),
    }
    readonly worldMatrix = mat4.create()
    protected needsUpdate() {
        const cache = this.cachedStatus
        return cache.parent !== this.parent ||
            !vec3.exactEquals(this.pos, cache.pos) ||
            !quat.exactEquals(this.rot, cache.rot) ||
            !vec3.exactEquals(this.scl, cache.scl)
    }
    protected updateMatrix() {
        const cache = this.cachedStatus
        mat4.fromRotationTranslationScale(
            this.worldMatrix,
            quat.copy(cache.rot, this.rot),
            vec3.copy(cache.pos, this.pos),
            vec3.copy(cache.scl, this.scl))
        if (cache.parent = this.parent) {
            mat4.multiply(this.worldMatrix, cache.parent.worldMatrix, this.worldMatrix)
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
    walk(func: (obj: Obj3, parent?: Obj3) => void) {
        func(this, this.parent)
        for (const child of this.children) {
            child.walk(func)
        }
    }
}
