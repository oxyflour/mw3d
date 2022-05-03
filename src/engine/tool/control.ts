import { vec3, mat4, quat } from "gl-matrix"

import Obj3 from "../obj3"
import { PerspectiveCamera } from "../camera"

function vec3FromObj(out: vec3, obj: Obj3) {
    const { worldPosition: [x, y, z] } = obj
    return vec3.set(out, x, y, z)
}

export class Control {
    constructor(
        readonly canvas: HTMLCanvasElement,
        readonly camera: PerspectiveCamera,
        readonly pivot = new Obj3(),
        readonly opts?: {
            hooks?: {
                mouse?: (evt: MouseEvent, next: (evt: MouseEvent) => Promise<any>) => Promise<any>
                wheel?: (evt: WheelEvent, next: (evt: WheelEvent) => Promise<any>) => Promise<any>
                click?: (evt: MouseEvent) => any
            },
        }) {
        canvas.addEventListener('mousedown', this.bindMouseDown = this.bindMouseDown.bind(this))
        canvas.addEventListener('wheel', this.bindMouseWheel = this.bindMouseWheel.bind(this))
    }
    bindMouseDown(evt: MouseEvent) {
        const hook = this.opts?.hooks?.mouse
        hook ? hook(evt, evt => this.onMouseDown(evt)) : this.onMouseDown(evt)
    }
    async onMouseDown(evt: MouseEvent) {
        const { canvas, camera, pivot, opts } = this,
            start = { clientX: evt.clientX, clientY: evt.clientY, hasMoved: false }
        function onMouseUp(evt: MouseEvent) {
            if (!start.hasMoved &&
                Math.abs(start.clientX - evt.clientX) < 2 &&
                Math.abs(start.clientY - evt.clientY) < 2) {
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
            start.hasMoved = true
            vec3FromObj(origin, camera)
            vec3FromObj(target, pivot)
            vec3.set(axis, start.clientY - evt.clientY, start.clientX - evt.clientX, 0)
            vec3.transformMat4(axis, axis, camera.worldMatrix)
            vec3.sub(axis, axis, origin)
            vec3.normalize(axis, axis)
            if (vec3.length(axis)) {
                mat4.identity(rotation)
                mat4.rotate(rotation, rotation, 0.02, axis)
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
            start.hasMoved = true
            vec3FromObj(origin, camera)
            getWorldDirFromScreen(from, start.clientX, start.clientY)
            getWorldDirFromScreen(target, evt.clientX, evt.clientY)
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
            canvas.addEventListener('mousemove', onRotateAroundPivot)
            canvas.addEventListener('mouseup', function onceMouseUp(evt) {
                onMouseUp(evt)
                canvas.removeEventListener('mousemove', onRotateAroundPivot)
                canvas.removeEventListener('mouseup', onceMouseUp)
            })
        } else if (evt.button === 1) {
            canvas.addEventListener('mousemove', onDragWithPivot)
            canvas.addEventListener('mouseup', function onceMouseUp(evt) {
                onMouseUp(evt)
                canvas.removeEventListener('mousemove', onDragWithPivot)
                canvas.removeEventListener('mouseup', onceMouseUp)
            })
        }
    }
    bindMouseWheel(evt: WheelEvent) {
        const hook = this.opts?.hooks?.wheel
        hook ? hook(evt, evt => this.onMouseWheel(evt)) : this.onMouseWheel(evt)
    }
    async onMouseWheel(evt: WheelEvent) {
        const { camera, pivot } = this,
            origin = vec3.create(),
            target = vec3.create(),
            delta = vec3.create(),
            rot = quat.create()
        vec3FromObj(origin, camera)
        vec3FromObj(target, pivot)
        vec3.sub(delta, origin, target)
        const distance = vec3.length(delta) * (evt.deltaY > 0 ? 1.1 : 0.9)
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
