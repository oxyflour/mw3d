import {
    Canvas, Control, Engine, Mesh, MeshDefault, useCanvas,
    Tool, CanvasContextValue, useFrame
} from '@ttk/react'
import React, { useEffect, useRef } from 'react'
import { Entity, TreeEnts } from '../../utils/data/entity'

import './index.less'

type CompProp<T> = T extends (...args: [infer A]) => any ? A : never
export type EntityProps = CompProp<typeof Mesh> & { data: Entity, active: boolean }

const [r = 0, g = 0, b = 0] = MeshDefault.mat.prop.data
export const MAT_DIM = new Engine.BasicMaterial({ color: [r, g, b, 0.2] })

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

let pickerCache = null as null | Promise<Tool.Picker>
const pivot = new Engine.Mesh(MeshDefault.geo, new Engine.BasicMaterial({
    color: [1, 0, 0]
}), {
    scaling: [0.1, 0.1, 0.1]
})
async function pick(
        { canvas, scene, camera }: CanvasContextValue,
        { clientX, clientY }: { clientX: number, clientY: number }) {
    if (!canvas || !scene || !camera) {
        throw Error(`renderer not initialized`)
    }
    const picker = await (pickerCache || (pickerCache = Tool.Picker.init())),
        { left, top } = canvas.getBoundingClientRect(),
        list = new Set(Array.from(scene).filter(item => item !== pivot))
    return await picker.pick(list, camera, {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        x: clientX - left,
        y: clientY - top,
    })
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
        pivot.position.set(x, y, z)
    }
}
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
            scene.add(pivot)
            return () => { scene.delete(pivot) }
        } else {
            return () => { }
        }
    }, [scene])
    useFrame(() => {
        if (camera) {
            const [cx, cy, cz] = camera.worldPosition as any as [number, number, number],
                [px, py, pz] = pivot.worldPosition as any as [number, number, number],
                d = Math.sqrt((cx - px) ** 2 + (cy - py) ** 2 + (cz - pz) ** 2) || 10,
                r = camera.fov * 0.01 * d
            pivot.scaling.set(r, r, r)
        }
    })
    async function align(
            evt: MouseEvent | WheelEvent,
            next: (evt: MouseEvent & WheelEvent) => Promise<any>) {
        updatePivot(ctx, evt)
        return await next(evt as any)
    }
    async function click(evt: MouseEvent) {
        // double click
        if (Date.now() - clickedAt.current < 500) {
            const { id } = await pick(ctx, evt)
            let found = undefined as undefined | Engine.Obj3
            id && scene?.walk(obj => obj.id === id && (found = obj))
            select.current?.(found)
        }
        clickedAt.current = Date.now()
    }
    return <Control pivot={ pivot } hooks={{
        mouse: align,
        wheel: align,
        click,
    }} />
}

export default ({ tree, ents, onSelect, meshComponent }: {
    tree: TreeEnts
    ents: Entity[]
    onSelect?: (ent?: Entity) => any
    meshComponent?: (props: EntityProps) => any
}) => {
    const selected = Object.keys(tree.$selected?.children || { }),
        objs = useRef({ } as Record<number, { obj: Engine.Obj3, ent: Entity }>)
    return <Canvas className="view" style={{ width: '100%', height: '100%' }}>
        {
            ents.map((ent, key) => {
                const nodes = ent.nodes || []
                if (nodes.length > 0 && nodes.every(id => tree[id]?.checked)) {
                    const active = !selected.length || nodes.some(id => tree[id]?.selected),
                        onCreated = (obj: Engine.Obj3) => objs.current[obj.id] = { obj, ent },
                        props = { key, onCreated, active, data: ent } as EntityProps
                    ent.trans && (props.matrix = ent.trans)
                    !active && (props.mat = MAT_DIM)
                    return meshComponent ? React.createElement(meshComponent, props) : <Mesh { ...props } />
                } else {
                    return null
                }
            })
        }
        <MouseControl onSelect={
            obj => {
                const item = objs.current[obj?.id || -1]
                item ? onSelect?.(item.ent) : onSelect?.()
            }
        } />
    </Canvas>
}
