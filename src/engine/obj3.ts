/// <reference path="../typing.d.ts" />
import loader from '@assemblyscript/loader'
import { mat4, quat, vec3, vec4 } from 'gl-matrix'
import { Vec3, Quat, Mutable } from '../utils/math'

import wasmUrl from './wasm/obj3.as.ts'
type Obj3WasmExp = typeof import('./wasm/obj3.as')

export default class Obj3 extends Mutable {
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
    readonly worldPosition = vec4.create()
    setWorldMatrix(mat: mat4) {
        mat4.copy(this.worldMatrix, mat)
        if (this.parent) {
            this.parent.updateIfNecessary()
            const inv = mat4.create()
            mat4.invert(inv, this.parent.worldMatrix)
            mat4.multiply(mat, inv, mat)
        }
        // https://github.com/toji/gl-matrix/issues/245#issuecomment-471719314
        mat4.getScaling(this.scaling.data, mat)
        const [x, y, z] = this.scaling.data
        mat4.scale(mat, mat, [1/x, 1/y, 1/z])
        mat4.getRotation(this.rotation.data, mat)
        mat4.getTranslation(this.position.data, mat)
        this.isDirty = true
    }
    protected needsUpdate() {
        const cache = this.cachedStatus
        return this.isDirty ||
            cache.parent !== this.parent ||
            // @ts-ignore
            this.position.needsUpdate() ||
            // @ts-ignore
            this.rotation.needsUpdate() ||
            // @ts-ignore
            this.scaling.needsUpdate()
    }
    protected update() {
        super.update()

        const cache = this.cachedStatus
        mat4.fromRotationTranslationScale(
            this.worldMatrix, this.rotation.data, this.position.data, this.scaling.data)
        if (cache.parent = this.parent) {
            mat4.multiply(this.worldMatrix, cache.parent.worldMatrix, this.worldMatrix)
        }

        // @ts-ignore
        this.position.update()
        // @ts-ignore
        this.rotation.update()
        // @ts-ignore
        this.scaling.update()

        vec4.set(this.worldPosition, 0, 0, 0, 1)
        vec4.transformMat4(this.worldPosition, this.worldPosition, this.worldMatrix)

        for (const child of this.children) {
            child.update()
        }
    }
    updateIfNecessary(updated?: (obj: Obj3) => void) {
        if (this.needsUpdate()) {
            this.update()
            updated && this.walk(updated)
        } else {
            for (const child of this.children) {
                child.updateIfNecessary(updated)
            }
        }
    }

    private static counter = 0
    readonly id: number
    ptr: number
    constructor() {
        super()
        this.id = Obj3.counter ++
        Obj3.initWasm.then(wasm => this.ptr = wasm.create())
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
