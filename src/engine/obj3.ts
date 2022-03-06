import * as AsBindImported from 'as-bind'
import { mat4, quat, vec3 } from 'gl-matrix'
import { Vec3, Quat } from '../utils/math'

import wasmUrl from './wasm/obj3.as.ts'
type Obj3WasmExp = typeof import('./wasm/obj3.as')
async function loadWasm() {
    // AsBind types are broken
    const { instantiate } = AsBindImported as any,
        { exports } = await instantiate(fetch(wasmUrl)) as { exports: Obj3WasmExp }
    return exports
}

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
        Obj3.initWasm.then(wasm => wasm.removeFrom(child.id, this.id))
    }
    addTo(parent: Obj3) {
        if (this.parent) {
            this.parent.children.delete(this)
        }
        if (this.parent = parent) {
            this.parent.children.add(this)
        }
        Obj3.initWasm.then(wasm => wasm.addTo(this.id, parent.id))
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
            this.position.isDirty ||
            this.rotation.isDirty ||
            this.scaling.isDirty
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
        this.position.isDirty = this.rotation.isDirty = this.scaling.isDirty = false
        for (const child of this.children) {
            child.updateMatrix()
        }
    }
    updateIfNecessary(updated = [] as Obj3[]) {
        if (this.needsUpdate()) {
            this.updateMatrix()
            updated.push(this)
        } else {
            for (const child of this.children) {
                child.updateIfNecessary(updated)
            }
        }
        return updated
    }

    private static counter = 0
    readonly id: number
    constructor() {
        this.id = Obj3.counter ++
        Obj3.initWasm.then(wasm => wasm.create(this.id))
    }
    walk(func: (obj: Obj3, parent?: Obj3) => void) {
        func(this, this.parent)
        for (const child of this.children) {
            child.walk(func)
        }
    }

    private static initWasm = loadWasm().then(wasm => Obj3.wasmMod = wasm)
    private static wasmMod: Obj3WasmExp
    static update(objs: Set<Obj3>) {
        // too slow
        Obj3.wasmMod?.update(Array.from(objs).map(obj => obj.id))
    }
}
