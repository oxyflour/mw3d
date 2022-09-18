import {
    Canvas, Control, Engine, Mesh, useCanvas,
    Tool, CanvasContextValue, useFrame, Obj3
} from '@ttk/react'
import { Edge, Face } from '@yff/ncc'
import React, { useEffect, useRef, useState } from 'react'
import lambda from '../../lambda'
import { unpack } from '../../utils/common/pack'
import { queue } from '../../utils/common/queue'
import { Entity, TreeEnts } from '../../utils/data/entity'
import { TreeData, TreeNode } from '../../utils/data/tree'
import { ViewOpts } from '../../utils/data/view'
import { KeyBinding, KeyMap } from '../../utils/dom/keys'
import { useAsync } from '../../utils/react/hooks'

import './index.less'

type CompProp<T> = T extends (...args: [infer A]) => any ? A : never
export type EntityProps = CompProp<typeof Mesh> & { view: ViewOpts, data: Entity, active: boolean }

const [r = 0, g = 0, b = 0] = [1, 2, 3].map(() => Math.random())
export const MATERIAL_SET = {
    default: new Engine.BasicMaterial({ color: [r, g, b, 1.0], lineWidth: devicePixelRatio * 3, emissive: 0.2 }),
    dimmed:  new Engine.BasicMaterial({ color: [r, g, b, 0.7], lineWidth: devicePixelRatio * 3 })
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

const CAMERA_PIVOT = new Engine.Mesh(
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
        list = new Set(Array.from(scene).filter(item => item !== CAMERA_PIVOT))
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
        CAMERA_PIVOT.position.set(x, y, z)
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
    return <Control pivot={ CAMERA_PIVOT } hooks={{
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
        'f': down => !down && setView({ ...view, pick: { ...view.pick, mode: 'face' } }),
        'e': down => !down && setView({ ...view, pick: { ...view.pick, mode: 'edge' } }),
        'Escape': down => !down && setView({ ...view, pick: { ...view.pick, mode: undefined } }),
    } as KeyMap)
    return null
}

type Obj3WithEntity = Engine.Obj3 & { entity?: Entity }

const pickEntity = queue(pick),
    SELECT_MAT = new Engine.BasicMaterial({ color: [1, 0, 0, 0.1], depth: { bias: 1 }, entry: { frag: 'fragMainColor' } }),
    HOVER_MAT = new Engine.BasicMaterial({ color: [1, 0, 0, 0.99], depth: { bias: 1 }, entry: { frag: 'fragMainColor' } }),
    PICK_CACHE = { } as Record<string, Record<number, Engine.Mesh>>
function EntityPicker({ mode }: { mode: string }) {
    const { scene, canvas, ...rest } = useCanvas(),
        [hover, setHover] = useState({ clientX: -1, clientY: -1, entity: undefined as undefined | Entity }),
        callback = useRef<(evt: MouseEvent) => any>()
    callback.current = async function onMouseMove({ clientX, clientY }: MouseEvent) {
        const meshes = (Array.from(scene || []) as Obj3WithEntity[]).filter(item => item.entity),
            map = Object.fromEntries(meshes.map(mesh => [mesh.id, mesh.entity!])),
            ret = await pickEntity({ scene: new Engine.Scene(meshes), canvas, ...rest }, { clientX, clientY })
        setHover({ clientX, clientY, entity: map[ret.id] })
    }
    useEffect(() => {
        if (canvas) {
            const onMouseMove = (evt: MouseEvent) => callback.current?.(evt)
            canvas.addEventListener('mousemove', onMouseMove)
            return () => canvas.removeEventListener('mousemove', onMouseMove)
        } else {
            return () => { }
        }
    }, [canvas])
    return hover.entity &&
        <TopoPicker mode={ mode } entity={ hover.entity } hover={ hover } /> || null
}

const pickTopo = queue(pick)
async function loadTopo(mode: string, entity: Entity) {
    const url = 
        (mode === 'face' && entity.topo?.faces?.url) ||
        (mode === 'edge' && entity.topo?.edges?.url) ||
        ''
    return PICK_CACHE[url] || (PICK_CACHE[url] = Object.fromEntries(
        (url ? unpack(await lambda.assets.get(url)) as any[] : [])
            .map(data => {
                const geo =
                    mode === 'face' ? new Engine.Geometry(data as Face) :
                    mode === 'edge' ? new Engine.LineList({ lines: [(data as Edge).positions] }) :
                    undefined
                return new Engine.Mesh(geo, SELECT_MAT)
            }).map(mesh => [mesh.id, mesh])))
}
function TopoPicker({ mode, entity, hover }: { mode: string, entity: Entity, hover: { clientX: number, clientY: number } }) {
    const [{ value = { } }] = useAsync(loadTopo, [mode, entity]),
        ctx = useCanvas(),
        [hoverTopo, setHoverTopo] = useState<Engine.Mesh>()
    async function updateHoverFace(meshes: Engine.Mesh[]) {
        const ret = meshes.length && await pickTopo({ ...ctx, scene: new Engine.Scene(meshes) }, hover) || { id: 0 }
        setHoverTopo(value[ret.id])
    }
    useEffect(() => {
        updateHoverFace(Object.values(value))
    }, [value, hover])
    return <Obj3 matrix={ entity.trans }>
    {
        Object.values(value).map(item => <Mesh key={ item.id } geo={ item.geo }
            mat={
                item.id === hoverTopo?.id ? HOVER_MAT :
                mode === 'face' ? undefined :
                    item.mat
            } />)
    }
    </Obj3>
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
                    return { }
                }
            }>
        {
            ents.map((data, key) => {
                const nodes = data.nodes || []
                if (nodes.length > 0 && checked(tree, nodes)) {
                    const active = !selected.length || nodes.some(id => tree[id]?.selected),
                        mat = active ? MATERIAL_SET.default : MATERIAL_SET.dimmed,
                        matrix = data.trans,
                        create = () => Object.assign(new Engine.Mesh(), { entity: data })
                    return React.createElement(component || Mesh, { key, view, active, data, mat, matrix, create } as EntityProps)
                } else {
                    return null
                }
            })
        }
        <KeyControl view={ view } setView={ setView } />
        <MouseControl onSelect={
            (obj?: Obj3WithEntity) => onSelect?.(obj?.entity?.nodes, obj)
        } />
        { view.pick?.mode && <EntityPicker mode={ view.pick.mode } /> }
        { children }
    </Canvas>
}
