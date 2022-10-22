import { CanvasContextValue, Control, Engine, useCanvas, useFrame } from "@ttk/react"
import { useEffect, useRef } from "react"
import { queue } from "../../../utils/common/queue"
import { CAMERA_PIVOT, pick } from "../pick/utils"

async function showBuffer(buffer: ArrayBuffer, canvas: HTMLCanvasElement) {
    const image = document.createElement('img')
    image.src = URL.createObjectURL(new Blob([buffer]))
    await image.decode()
    image.style.position = 'absolute'
    const { left, top, right, bottom } = canvas.getBoundingClientRect()
    image.style.left = left + 'px'
    image.style.top = top + 'px'
    image.style.right = right + 'px'
    image.style.bottom = bottom + 'px'
    image.addEventListener('click', () => document.body.removeChild(image))
    document.body.appendChild(image)
}

async function updatePivot(
        ctx: CanvasContextValue,
        evt: { clientX: number, clientY: number }) {
    const { id, position, buffer } = await pick(ctx, evt)
    if (ctx.canvas && (window as any).DEBUG_SHOW_PICK_BUFFER) {
        await showBuffer(buffer, ctx.canvas)
    }
    if (id > 0) {
        const [x = 0, y = 0, z = 0] = position
        CAMERA_PIVOT.position.set(x, y, z)
    }
}
const updatePivotEnqueue = queue(updatePivot)

export function MouseControl({ onSelect }: {
    onSelect?: (obj?: Engine.Obj3) => any
}) {
    const ctx = useCanvas(),
        { scene, camera } = ctx,
        clickedAt = useRef(0),
        select = useRef(onSelect)
    select.current = onSelect
    useEffect(() => {
        if (scene) {
            scene.add(CAMERA_PIVOT)
            return () => { scene.delete(CAMERA_PIVOT) }
        } else {
            return () => { }
        }
    }, [scene])
    useFrame(() => {
        if (camera) {
            const [cx, cy, cz] = camera.worldPosition as any as [number, number, number],
                [px, py, pz] = CAMERA_PIVOT.worldPosition as any as [number, number, number],
                d = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2 + (cz - pz) ** 2) || 10,
                r = camera.fov * 0.01 * d
            CAMERA_PIVOT.scaling.set(r, r, r)
        }
    })
    async function align(evt: MouseEvent | WheelEvent, next: (evt: MouseEvent & WheelEvent) => Promise<any>) {
        updatePivot(ctx, evt)
        return await next(evt as any)
    }
    async function alignEnqueue(evt: MouseEvent | WheelEvent, next: (evt: MouseEvent & WheelEvent) => Promise<any>) {
        updatePivotEnqueue(ctx, evt)
        return await next(evt as any)
    }
    async function click(evt: MouseEvent) {
        // double click
        if (Date.now() - clickedAt.current < 500) {
            const { id } = await pick(ctx, evt)
            let found = undefined as undefined | Engine.Obj3
            id && scene?.walk(obj => obj.id === id && (found = obj))
            select.current?.(found)
            clickedAt.current = 0
        } else {
            clickedAt.current = Date.now()
        }
    }
    return <Control pivot={ CAMERA_PIVOT } hooks={{
        mouse: align,
        wheel: alignEnqueue,
        click,
    }} />
}
