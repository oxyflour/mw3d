import { vec3, mat4, quat } from "gl-matrix"

import Obj3 from "../engine/obj3"
import { PerspectiveCamera } from "../engine/camera"

function vec3FromObj(out: vec3, obj: Obj3) {
    const { worldPosition: [x = 0, y = 0, z = 0] } = obj
    return vec3.set(out, x, y, z)
}

export class Control {
    readonly pivot: Obj3
    constructor(
        readonly canvas: HTMLCanvasElement,
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
                mouse?: (evt: MouseEvent, next: (evt: MouseEvent) => Promise<any>) => Promise<any>
                wheel?: (evt: WheelEvent, next: (evt: WheelEvent) => Promise<any>) => Promise<any>
                click?: (evt: MouseEvent) => any
            },
        }) {
        this.pivot = opts?.pivot || new Obj3()
        canvas.addEventListener('mousedown', this.bindMouseDown = this.bindMouseDown.bind(this))
        canvas.addEventListener('wheel', this.bindMouseWheel = this.bindMouseWheel.bind(this))
    }
    bindMouseDown(evt: MouseEvent) {
        const hook = this.opts?.hooks?.mouse
        hook ? hook(evt, evt => this.onMouseDown(evt)) : this.onMouseDown(evt)
    }
    async onMouseDown(evt: MouseEvent) {
        const { canvas, camera, pivot, opts } = this,
            { left, top } = canvas.getBoundingClientRect(),
            start = { clientX: evt.clientX, clientY: evt.clientY, hasMoved: false }
        function onMouseUp(evt: MouseEvent) {
            if (Math.abs(start.clientX - evt.clientX) > 2 ||
                Math.abs(start.clientY - evt.clientY) > 2) {
                start.hasMoved = true
            }
            if (!start.hasMoved) {
                opts?.hooks?.click?.(evt)
            }
        }
        const axis = vec3.create(),
            origin = vec3.create(),
            from = vec3.create(),
            target = vec3.create(),
            delta = vec3.create(),
            tran = mat4.create(),
            rotation = mat4.create(),
            rot = quat.create()
        function onRotateAroundPivot(evt: MouseEvent) {
            if (Math.abs(start.clientX - evt.clientX) > 2 ||
                Math.abs(start.clientY - evt.clientY) > 2) {
                start.hasMoved = true
            }
            vec3FromObj(origin, camera)
            vec3FromObj(target, pivot)
            vec3.set(axis, start.clientY - evt.clientY, start.clientX - evt.clientX, 0)
            vec3.transformMat4(axis, axis, camera.worldMatrix)
            vec3.sub(axis, axis, origin)
            vec3.normalize(axis, axis)
            if (vec3.length(axis)) {
                mat4.identity(rotation)
                mat4.rotate(rotation, rotation, opts?.rotate?.speed || 0.05, axis)
                vec3.sub(delta, origin, target)
                vec3.transformMat4(delta, delta, rotation)
                vec3.add(target, target, delta)

                mat4.getRotation(rot, camera.worldMatrix)
                mat4.fromQuat(tran, rot)
                mat4.multiply(tran, rotation, tran)
                mat4.fromTranslation(rotation, target)
                mat4.multiply(tran, rotation, tran)

                camera.setWorldMatrix(tran)
            }
            start.clientX = evt.clientX
            start.clientY = evt.clientY
        }
        const [hw, hh, hf] = [canvas.clientWidth / 2, canvas.clientHeight / 2, camera.fov / 2],
            [tx, ty] = [Math.tan(hf * camera.aspect), Math.tan(hf)]
        function getWorldDirFromScreen(out: vec3, x: number, y: number) {
            vec3.set(out, tx * (x - hw) / hw, ty * (y - hh) / -hh, -1)
            vec3.transformMat4(out, out, camera.worldMatrix)
            vec3.sub(out, out, origin)
            vec3.normalize(out, out)
        }
        function onDragWithPivot(evt: MouseEvent) {
            if (Math.abs(start.clientX - evt.clientX) > 2 ||
                Math.abs(start.clientY - evt.clientY) > 2) {
                start.hasMoved = true
            }
            vec3FromObj(origin, camera)
            getWorldDirFromScreen(from, start.clientX - left, start.clientY - top)
            getWorldDirFromScreen(target, evt.clientX - left, evt.clientY - top)
            vec3.cross(axis, from, target)
            vec3.normalize(axis, axis)
            const rad = vec3.angle(from, target)
            mat4.identity(rotation)
            mat4.rotate(rotation, rotation, -rad, axis)

            mat4.getRotation(rot, camera.worldMatrix)
            mat4.fromQuat(tran, rot)
            mat4.multiply(tran, rotation, tran)
            mat4.fromTranslation(rotation, origin)
            mat4.multiply(tran, rotation, tran)

            camera.setWorldMatrix(tran)

            start.clientX = evt.clientX
            start.clientY = evt.clientY
        }
        if (evt.button === 0) {
            document.body.addEventListener('mousemove', onRotateAroundPivot)
            document.body.addEventListener('mouseup', function onceMouseUp(evt) {
                onMouseUp(evt)
                document.body.removeEventListener('mousemove', onRotateAroundPivot)
                document.body.removeEventListener('mouseup', onceMouseUp)
            })
        } else if (evt.button === 1) {
            document.body.addEventListener('mousemove', onDragWithPivot)
            document.body.addEventListener('mouseup', function onceMouseUp(evt) {
                onMouseUp(evt)
                document.body.removeEventListener('mousemove', onDragWithPivot)
                document.body.removeEventListener('mouseup', onceMouseUp)
            })
        }
    }
    bindMouseWheel(evt: WheelEvent) {
        const hook = this.opts?.hooks?.wheel
        hook ? hook(evt, evt => this.onMouseWheel(evt)) : this.onMouseWheel(evt)
    }
    async onMouseWheel(evt: WheelEvent) {
        const { camera, pivot, opts } = this,
            origin = vec3.create(),
            target = vec3.create(),
            delta = vec3.create(),
            rot = quat.create()
        vec3FromObj(origin, camera)
        vec3FromObj(target, pivot)
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
