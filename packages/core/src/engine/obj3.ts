/// <reference path="../typing.d.ts" />
//import loader from '@assemblyscript/loader'
import { mat4, vec3, vec4, quat } from 'gl-matrix'
import { AutoIndex } from '../utils/common'
import { Vec3, Quat } from '../utils/math'

//import wasmUrl from './wasm/obj3.as.ts'
//type Obj3WasmExp = typeof import('./wasm/obj3.as')

export class Scene extends Set<Obj3> {
    background?: string
    walk(func: (obj: Obj3, parent?: Obj3) => void) {
        for (const obj of this) {
            obj.walk(func)
        }
    }
}

export interface ObjOpts {
    position?: [number, number, number]
    rotation?: [number, number, number]
    scaling?: [number, number, number]
    children?: Obj3[]
}

const axis = vec3.create(),
    src = vec3.create(),
    dst = vec3.create(),
    rotation = mat4.create(),
    rot = quat.create(),
    rot2 = quat.create()
export default class Obj3 extends AutoIndex {
    readonly position = new Vec3()
    readonly rotation = new Quat()
    readonly scaling = new Vec3(vec3.fromValues(1, 1, 1))

    private parent?: Obj3
    readonly children = new Set<Obj3>()
    add(child: Obj3) {
        child.addTo(this)
    }
    delete(child: Obj3) {
        this.children.delete(child)
        if (child.parent === this) {
            child.parent = undefined
        }
        this.cachedStatus.rev ++
        child.cachedStatus.rev ++
        //Obj3.initWasm.then(wasm => wasm.removeFrom(child.ptr, this.ptr))
    }
    addTo(parent: Obj3) {
        if (this.parent) {
            this.parent.children.delete(this)
        }
        if (this.parent = parent) {
            this.parent.children.add(this)
        }
        this.cachedStatus.rev ++
        parent.cachedStatus.rev ++
        //Obj3.initWasm.then(wasm => wasm.addTo(this.ptr, parent.ptr))
    }
    getParent() {
        return this.parent
    }

    private cachedStatus = {
        rev: 1,
        parent: undefined as Obj3 | undefined,
    }
    readonly worldMatrix = mat4.create()
    readonly worldPosition = vec4.create()

    private static setWorldMatrixTmp = mat4.create()
    setWorldMatrix(src: mat4) {
        const mat = mat4.copy(Obj3.setWorldMatrixTmp, src)
        mat4.copy(this.worldMatrix, mat)
        if (this.parent) {
            this.parent.update()
            const inv = mat4.create()
            mat4.invert(inv, this.parent.worldMatrix)
            mat4.multiply(mat, inv, mat)
        }
        // https://github.com/toji/gl-matrix/issues/245#issuecomment-471719314
        mat4.getScaling(this.scaling.data, mat)
        const [x = 1, y = 1, z = 1] = this.scaling.data
        mat4.scale(mat, mat, [1 / x, 1 / y, 1 / z])
        mat4.getRotation(this.rotation.data, mat)
        mat4.getTranslation(this.position.data, mat)
        this.update()
        this.cachedStatus.rev ++
    }
    get rev() {
        return this.cachedStatus.rev +
            this.position.rev +
            this.rotation.rev +
            this.scaling.rev
    }
    protected update() {
        const cache = this.cachedStatus
        mat4.fromRotationTranslationScale(
            this.worldMatrix, this.rotation.data, this.position.data, this.scaling.data)
        if (cache.parent = this.parent) {
            mat4.multiply(this.worldMatrix, cache.parent.worldMatrix, this.worldMatrix)
        }

        vec4.set(this.worldPosition, 0, 0, 0, 1)
        vec4.transformMat4(this.worldPosition, this.worldPosition, this.worldMatrix)
        for (const child of this.children) {
            child.update()
        }
    }
    updateIfNecessary(revs: Record<number, number>, updated?: (obj: Obj3) => void) {
        const { id, rev } = this
        if (revs[id] !== rev && (revs[id] = rev)) {
            this.update()
            updated && this.walk(updated)
        } else {
            for (const child of this.children) {
                child.updateIfNecessary(revs, updated)
            }
        }
    }

    constructor(opts?: ObjOpts) {
        super()
        if (opts?.position) {
            this.position.set(...opts.position)
        }
        if (opts?.rotation) {
            const [x, y, z] = opts.rotation
            this.rotation.rotX(x).rotY(y).rotZ(z)
        }
        if (opts?.scaling) {
            this.scaling.set(...opts.scaling)
        }
        if (opts?.children) {
            for (const item of opts.children) {
                this.add(item)
            }
        }
        //Obj3.initWasm.then(wasm => this.ptr = wasm.create())
    }
    walk(func: (obj: Obj3, parent?: Obj3) => void) {
        func(this, this.parent)
        for (const child of this.children) {
            child.walk(func)
        }
    }

    /*
    ptr!: number
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
     */

    /**
     * Note: remember to update camera first
     */
    rotateInWorld(source: vec3, target: vec3) {
        vec3.cross(axis, source, target)
        if (axis[0] || axis[1] || axis[2]) {
            const rad = vec3.angle(source, target)
            vec3.normalize(axis, axis)
            mat4.fromRotation(rotation, -rad, axis)
            mat4.getRotation(rot, rotation)
            mat4.getRotation(rot2, this.worldMatrix)
            quat.multiply(rot, rot, rot2)
            quat.normalize(rot, rot)
            this.rotation.assign(rot)
            this.update()
        }
    }
    /**
     * 
     */
    targetToWorld(pivot: vec3, target: vec3) {
        vec3.sub(src, this.worldPosition as vec3, pivot)
        vec3.sub(dst, target, pivot)
        vec3.cross(axis, dst, src)
        if (axis[0] || axis[1] || axis[2]) {
            const rad = vec3.angle(dst, src)
            vec3.normalize(axis, axis)
            mat4.fromRotation(rotation, -rad, axis)
            mat4.getRotation(rot, rotation)
            mat4.getRotation(rot2, this.worldMatrix)
            quat.multiply(rot, rot, rot2)
            quat.normalize(rot, rot)
            this.rotation.assign(rot)
            this.position.assign(target)
            this.update()
        }
    }
}
