import {
    Canvas, Control, Engine, Mesh, useCanvas,
    Tool, CanvasContextValue, useFrame
} from '@ttk/react'
import React, { useEffect, useRef } from 'react'
import { Entity, TreeEnts } from '../../utils/data/entity'
import { TreeData, TreeNode } from '../../utils/data/tree'
import { ViewOpts } from '../../utils/data/view'
import { KeyBinding, KeyMap } from '../../utils/dom/keys'

import './index.less'

type CompProp<T> = T extends (...args: [infer A]) => any ? A : never
export type EntityProps = CompProp<typeof Mesh> & { data: Entity, active: boolean }

const [r = 0, g = 0, b = 0] = [1, 2, 3].map(() => Math.random())
export const MATERIAL_SET = {
    default: new Engine.BasicMaterial({ color: [r, g, b, 1.0] }),
    dimmed:  new Engine.BasicMaterial({ color: [r, g, b, 0.7] })
}

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

const pivot = new Engine.Mesh(
    new Engine.SphereGeometry(),
    new Engine.BasicMaterial({
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
    const picker = await Tool.Picker.init(),
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
            clickedAt.current = 0
        } else {
            clickedAt.current = Date.now()
        }
    }
    return <Control pivot={ pivot } hooks={{
        mouse: align,
        wheel: align,
        click,
    }} />
}

function checked(tree: TreeData, nodes: string[]) {
    const ret = { } as TreeNode
    for (const id of nodes) {
        const node = tree[id]
        if (node && (node.checkedAt || 0) > (ret.checkedAt || -1)) {
            ret.checkedAt = node.checkedAt
            ret.checked = node.checked
        }
    }
    return ret.checked
}

function KeyControl({ view, setView }: { view: ViewOpts, setView: (view: ViewOpts) => void }) {
    const { canvas } = useCanvas(),
        map = useRef({ } as KeyMap)
    useEffect(() => {
        if (canvas) {
            const binding = new KeyBinding(canvas)
            binding.load(map.current)
            return () => binding.destroy()
        } else {
            return () => { }
        }
    }, [canvas])
    Object.assign(map.current, {
        'Control + x': down => !down && setView({ ...view, pick: { ...view.pick, mode: 'face' } }),
        'Escape': down => !down && setView({ ...view, pick: { ...view.pick, mode: undefined } }),
    } as KeyMap)
    return null
}

export default ({ tree, ents, view, setView, component, children, onSelect }: {
    tree: TreeEnts
    ents: Entity[]
    view: ViewOpts
    setView: (view: ViewOpts) => void
    component?: (props: EntityProps) => JSX.Element
    children?: any
    onSelect?: (nodes?: string[], obj?: Engine.Obj3) => any
}) => {
    const selected = Object.keys(tree.$selected?.children || { })
    return <Canvas className="view"
            style={{ width: '100%', height: '100%' }}
            options={
                canvas => {
                    // TODO: set context menu
                    canvas.oncontextmenu = () => false
                    return ({ multisample: { count: 4 }, devicePixelRatio: 1 })
                }
            }>
        {
            ents.map((data, key) => {
                const nodes = data.nodes || []
                if (nodes.length > 0 && checked(tree, nodes)) {
                    const active = !selected.length || nodes.some(id => tree[id]?.selected),
                        mat = active ? MATERIAL_SET.default : MATERIAL_SET.dimmed,
                        matrix = data.trans,
                        create = () => Object.assign(new Engine.Mesh(), { data })
                    return React.createElement(component || Mesh, { key, active, data, mat, matrix, create } as EntityProps)
                } else {
                    return null
                }
            })
        }
        <KeyControl view={ view } setView={ setView } />
        <MouseControl onSelect={
            (obj?: Engine.Obj3 & { data?: Entity }) => onSelect?.(obj?.data?.nodes, obj)
        } />
        { children }
    </Canvas>
}
