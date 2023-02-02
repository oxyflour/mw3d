import { CanvasContextValue, Control, Engine, Tool, useCanvas, useFrame } from "@ttk/react"
import { useEffect, useRef, useState } from "react"
import { queue } from "../../../utils/common/queue"
import { ViewOpts } from "../../../utils/data/view"
import { withMouseDown } from "../../../utils/dom/mouse"
import { CAMERA_PIVOT, Obj3WithEntity, pick } from "../pick/utils"

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

async function pickEntity(ctx: CanvasContextValue, evt: { clientX: number, clientY: number }) {
    const scene = new Engine.Scene(Array.from(ctx.scene || []).filter((item: Obj3WithEntity) => item.entity))
    return await pick({ ...ctx, scene }, evt)
}

async function updatePivot(
        ctx: CanvasContextValue,
        evt: { clientX: number, clientY: number }) {
    const { id, position, buffer } = await pickEntity(ctx, evt)
    if (ctx.canvas && (window as any).DEBUG_SHOW_PICK_BUFFER) {
        await showBuffer(buffer, ctx.canvas)
    }
    if (id > 0) {
        const [x = 0, y = 0, z = 0] = position
        CAMERA_PIVOT.position.set(x, y, z)
    }
}
const updatePivotEnqueue = queue(updatePivot)

export function MouseControl({ view, onSelect }: {
    view: ViewOpts
    onSelect?: (obj?: Engine.Obj3) => any
}) {
    const ctx = useCanvas(),
        { scene, camera } = ctx,
        clickedAt = useRef(0),
        select = useRef(onSelect),
        [overlay, setOverlay] = useState({ left: 0, top: 0, width: 0, height: 0 })
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
    function showOverlay(evt: MouseEvent, callback?: (data: typeof overlay) => any) {
        const start = { clientX: evt.clientX, clientY: evt.clientY }
        function getRect(evt: MouseEvent) {
            const left = Math.min(start.clientX, evt.clientX),
                top    = Math.min(start.clientY, evt.clientY),
                width  = Math.max(start.clientX, evt.clientX) - left,
                height = Math.max(start.clientY, evt.clientY) - top
            return { left, top, width, height }
        }
        withMouseDown(evt => setOverlay(getRect(evt)), async evt => {
            setOverlay({ ...overlay, width: 0, height: 0 })
            callback?.(getRect(evt))
        })
    }
    async function align(evt: MouseEvent, next: (evt: MouseEvent & WheelEvent) => Promise<any>, ctrl: Tool.Control) {
        if (view.mouseControl?.mode === 'zoom') {
            ctrl.mode = ''
            showOverlay(evt)
        } else if (view.mouseControl?.mode === 'pan') {
            ctrl.mode = 'pan'
        } else if (evt.shiftKey) {
            ctrl.mode = ''
            showOverlay(evt)
        }
        updatePivot(ctx, evt)
        return await next(evt as any)
    }
    async function alignEnqueue(evt: WheelEvent, next: (evt: MouseEvent & WheelEvent) => Promise<any>) {
        updatePivotEnqueue(ctx, evt)
        return await next(evt as any)
    }
    async function click(evt: MouseEvent) {
        // double click
        if (Date.now() - clickedAt.current < 500) {
            const scene = new Engine.Scene(Array.from(ctx.scene || []).filter((item: Obj3WithEntity) => item.entity)),
                { id } = await pickEntity({ ...ctx, scene }, evt)
            let found = undefined as undefined | Engine.Obj3
            id && scene?.walk(obj => obj.id === id && (found = obj))
            select.current?.(found)
            clickedAt.current = 0
        } else {
            clickedAt.current = Date.now()
        }
    }
    return <>
        {
            camera && <Control pivot={ CAMERA_PIVOT } hooks={{
                mouse: align,
                wheel: alignEnqueue,
                click,
            }} zoom={{
                distance: {
                    min: camera.near * 1.2,
                    max: camera.far * 0.9,
                }
            }}/>
        }
        {
            overlay.width > 0 && overlay.height > 0 &&
            <div style={{
                position: 'absolute',
                background: 'rgba(128, 128, 255, 0.5)',
                border: 'rgba(32, 32, 255, 0.5)',
                ...overlay,
            }} />
        }
    </>
}
