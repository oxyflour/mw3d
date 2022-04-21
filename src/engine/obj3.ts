/// <reference path="../typing.d.ts" />
import loader from '@assemblyscript/loader'
import { mat4, quat, vec3 } from 'gl-matrix'
import { Vec3, Quat } from '../utils/math'

import wasmUrl from './wasm/obj3.as.ts'
type Obj3WasmExp = typeof import('./wasm/obj3.as')

export default class Obj3 {
    readonly position = new Vec3()
    readonly rotation = new Quat()
    readonly scaling = new Vec3(vec3.fromValues(1, 1, 1))

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
        Obj3.initWasm.then(wasm => wasm.removeFrom(child.ptr, this.ptr))
    }
    addTo(parent: Obj3) {
        if (this.parent) {
            this.parent.children.delete(this)
        }
        if (this.parent = parent) {
            this.parent.children.add(this)
        }
        Obj3.initWasm.then(wasm => wasm.addTo(this.ptr, parent.ptr))
    }
    getParent() {
        return this.parent
    }

    private cachedStatus = {
        parent: null as Obj3 | null,
    }
    readonly worldMatrix = mat4.create()
    protected needsUpdate() {
        const cache = this.cachedStatus
        return cache.parent !== this.parent ||
            this.position.needsUpdate() ||
            this.rotation.needsUpdate() ||
            this.scaling.needsUpdate()
    }
    protected update() {
        const cache = this.cachedStatus
        mat4.fromRotationTranslationScale(
            this.worldMatrix, this.rotation.data, this.position.data, this.scaling.data)
        if (cache.parent = this.parent) {
            mat4.multiply(this.worldMatrix, cache.parent.worldMatrix, this.worldMatrix)
        }
        this.position.update()
        this.rotation.update()
        this.scaling.update()
        for (const child of this.children) {
            child.update()
        }
    }
    updateIfNecessary(updated = [] as any[]) {
        if (this.needsUpdate()) {
            this.update()
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
    ptr: number
    constructor() {
        this.id = Obj3.counter ++
        Obj3.initWasm.then(wasm => this.ptr = wasm.create(this.id))
    }
    walk(func: (obj: Obj3, parent?: Obj3) => void) {
        func(this, this.parent)
        for (const child of this.children) {
            child.walk(func)
        }
    }

    private static initWasm = loader.instantiateStreaming(fetch(wasmUrl), { console: console as any })
        .then(({ exports }) => Obj3.wasmMod = exports as any as loader.ASUtil & Obj3WasmExp)
    private static wasmMod: loader.ASUtil & Obj3WasmExp
    static ptrs = new Int32Array(10240)
    static update(objs: Set<Obj3>) {
        if (objs.size > this.ptrs.length) {
            this.ptrs = new Int32Array(objs.size)
        }
        let i = 0
        for (const obj of objs) {
            this.ptrs[i ++] = obj.ptr
        }
        Obj3.wasmMod?.update(this.ptrs, objs.size)
    }
}
