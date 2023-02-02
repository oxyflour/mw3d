import { vec3, mat4, quat } from "gl-matrix"

import Obj3 from "../engine/obj3"
import { PerspectiveCamera } from "../engine/camera"

function withMouseDown(onMouseMove: (evt: MouseEvent) => any, onMouseUp?: (evt: MouseEvent) => any) {
    document.body.addEventListener('mousemove', onMouseMove)
    document.body.addEventListener('mouseup', function onceMouseUp(evt) {
        onMouseUp?.(evt)
        document.body.removeEventListener('mousemove', onMouseMove)
        document.body.removeEventListener('mouseup', onceMouseUp)
    })
}

function lerp(from: number, to: number, factor: number) {
    return from * (1 - factor) + to * factor
}

type Pos = { clientX: number, clientY: number }
const axis = vec3.create(),
    origin = vec3.create(),
    source = vec3.create(),
    target = vec3.create(),
    delta = vec3.create(),
    rotation = mat4.create()

export class Control {
    readonly pivot: Obj3
    mode = '' as '' | 'rot' | 'pan' | 'zoom'
    constructor(
        readonly canvas: HTMLElement,
        readonly camera: PerspectiveCamera,
        readonly opts?: {
            pivot?: Obj3
            rotate?: {
                speed?: number
            }
            zoom?: {
                factor?: number
                distance?: {
                    min?: number
                    max?: number
                }
            },
            hooks?: {
                mouse?: (evt: MouseEvent, next: (evt: MouseEvent) => Promise<any>, ctrl: Control) => Promise<any>
                wheel?: (evt: WheelEvent, next: (evt: WheelEvent) => Promise<any>, ctrl: Control) => Promise<any>
                click?: (evt: MouseEvent) => any
            },
        }) {
        this.pivot = opts?.pivot || new Obj3()
        canvas.addEventListener('mousedown', this.bindMouseDown = this.bindMouseDown.bind(this))
        canvas.addEventListener('wheel', this.bindMouseWheel = this.bindMouseWheel.bind(this))
    }
    bindMouseDown(evt: MouseEvent) {
        const hook = this.opts?.hooks?.mouse
        this.mode = ['rot', 'pan'][evt.button] as typeof this.mode || ''
        hook ? hook(evt, evt => this.onMouseDown(evt), this) : this.onMouseDown(evt)
    }
    private readonly state = { hasMoved: false, isDown: false }
    private readonly source = { clientX: 0, clientY: 0 }
    private readonly target = { clientX: 0, clientY: 0 }
    update() {
        const { canvas, camera, pivot, opts } = this,
            { left, top } = canvas.getBoundingClientRect(),
            [hw, hh, hf] = [canvas.clientWidth / 2, canvas.clientHeight / 2, camera.fov / 2],
            [tx, ty] = [Math.tan(hf * camera.aspect), Math.tan(hf)],
            setNDC = (out: vec3, x: number, y: number) => vec3.set(out, tx * (x - hw) / hw, ty * (y - hh) / -hh, -1)
        function onRotateAroundPivot(p0: Pos, p1: Pos) {
            vec3.copy(origin, camera.worldPosition as vec3)
            vec3.copy(target, pivot.worldPosition as vec3)
            const dx = p0.clientX - p1.clientX,
                dy = p0.clientY - p1.clientY,
                ds = Math.sqrt(dx * dx + dy * dy)
            vec3.set(axis, dy, dx, 0)
            vec3.transformMat4(axis, axis, camera.worldMatrix)
            vec3.sub(axis, axis, origin)
            vec3.normalize(axis, axis)
            if (vec3.length(axis)) {
                mat4.fromRotation(rotation, (opts?.rotate?.speed || 0.005) * ds, axis)
                vec3.sub(delta, origin, target)
                vec3.transformMat4(delta, delta, rotation)
                vec3.add(target, target, delta)

                camera.targetToWorld(pivot.worldPosition as vec3, target)
            }
        }
        function onDragWithPivot(p0: Pos, p1: Pos) {
            camera.getWorldDirFromNDC(setNDC(source, p0.clientX - left, p0.clientY - top))
            camera.getWorldDirFromNDC(setNDC(target, p1.clientX - left, p1.clientY - top))
            camera.rotateInWorld(source, target)
        }
        if (this.state.isDown) {
            let factor = 1
            if (this.mode === 'rot') {
                onRotateAroundPivot(this.source, this.target)
                factor = 0.3
            } else if (this.mode === 'pan') {
                onDragWithPivot(this.source, this.target)
            }
            this.source.clientX = lerp(this.source.clientX, this.target.clientX, factor)
            this.source.clientY = lerp(this.source.clientY, this.target.clientY, factor)
        }
    }
    async onMouseDown(evt: MouseEvent) {
        const { opts, source, target, state } = this,
            { clientX, clientY } = evt
        Object.assign(source, { clientX, clientY })
        Object.assign(target, { clientX, clientY })
        state.hasMoved = false
        state.isDown = true
        withMouseDown(evt => {
            if (Math.abs(source.clientX - evt.clientX) > 2 ||
                Math.abs(source.clientY - evt.clientY) > 2) {
                state.hasMoved = true
            }
            target.clientX = evt.clientX
            target.clientY = evt.clientY
        }, evt => {
            if (Math.abs(source.clientX - evt.clientX) > 2 ||
                Math.abs(source.clientY - evt.clientY) > 2) {
                state.hasMoved = true
            }
            if (!state.hasMoved) {
                opts?.hooks?.click?.(evt)
            }
            state.isDown = false
        })
    }
    bindMouseWheel(evt: WheelEvent) {
        const hook = this.opts?.hooks?.wheel
        this.mode === 'zoom'
        hook ? hook(evt, evt => this.onMouseWheel(evt), this) : this.onMouseWheel(evt)
    }
    async onMouseWheel(evt: WheelEvent) {
        const { camera, pivot, opts } = this,
            origin = vec3.create(),
            target = vec3.create(),
            delta = vec3.create(),
            rot = quat.create()
        vec3.copy(origin, camera.worldPosition as vec3)
        vec3.copy(target, pivot.worldPosition as vec3)
        vec3.sub(delta, origin, target)
        const factor = opts?.zoom?.factor || 0.1
        let distance = vec3.length(delta) * (evt.deltaY > 0 ? (1 + factor) : (1 - factor))
        if (opts?.zoom?.distance?.min) {
            distance = Math.max(distance, opts?.zoom?.distance?.min)
        }
        if (opts?.zoom?.distance?.max) {
            distance = Math.min(distance, opts?.zoom?.distance?.max)
        }
        vec3.normalize(delta, delta)
        vec3.scale(delta, delta, distance)
        vec3.add(target, target, delta)
        mat4.getRotation(rot, camera.worldMatrix)
        mat4.fromRotationTranslation(camera.worldMatrix, rot, target)
        camera.setWorldMatrix(camera.worldMatrix)
    }
    detach() {
        this.canvas.removeEventListener('mousedown', this.bindMouseDown)
        this.canvas.removeEventListener('wheel', this.bindMouseWheel)
    }
}
