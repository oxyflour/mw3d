import { Canvas, Control, Engine, Mesh, MeshDefault, useCanvas, Tool, CanvasContextValue } from '@ttk/react'
import { useEffect, useRef } from 'react'
import { TreeNode } from '../nav'

import './index.less'

export interface Ent {
    attrs?: {
        $n?: string
        $m?: string
    } & Record<string, any>
    trans?: number[]
    geom?: {
        faces?: string
        edges?: string
    }
}

export type TreeEntNode = TreeNode & { entities?: Ent[] }
export type TreeEnts = Record<string, TreeEntNode> & {
    $root?: TreeEntNode
    $meshes?: TreeEntNode
    $selected?: TreeEntNode
}

type CompProp<T> = T extends (...args: [infer A]) => any ? A : never

const [r = 0, g = 0, b = 0] = MeshDefault.mat.prop.data,
    MAT_DIM = new Engine.BasicMaterial({ color: [r, g, b, 0.7] })
export function Entity({ data, active, onCreated }: {
    data: Ent
    active: boolean
    onCreated?: (obj: Engine.Obj3) => any
}) {
    const props = { onCreated } as CompProp<typeof Mesh>
    data.trans && (props.matrix = data.trans)
    !active && (props.mat = MAT_DIM)
    return <Mesh { ...props } />
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
    const { id, position } = await pick(ctx, evt)
    if (id > 0) {
        const [x = 0, y = 0, z = 0] = position
        pivot.position.set(x, y, z)
    }
}
export function MouseControl({ onSelect }: {
    onSelect?: (obj: Engine.Obj3) => any
}) {
    const ctx = useCanvas(),
        { scene } = ctx,
        clickedAt = useRef(0)
    useEffect(() => {
        if (scene) {
            scene.add(pivot)
            return () => { scene.delete(pivot) }
        } else {
            return () => { }
        }
    }, [scene])
    async function align(
            evt: MouseEvent | WheelEvent,
            next: (evt: MouseEvent & WheelEvent) => Promise<any>) {
        updatePivot(ctx, evt)
        return await next(evt as any)
    }
    async function click(evt: MouseEvent) {
        // double click
        if (Date.now() - clickedAt.current < 300) {
            const { id } = await pick(ctx, evt)
            if (id) {
                let found = null as null | Engine.Obj3
                scene?.walk(obj => obj.id === id && (found = obj))
                found && onSelect?.(found)
            }
        }
        clickedAt.current = Date.now()
    }
    return <Control pivot={ pivot } hooks={{
        mouse: align,
        wheel: align,
        click,
    }} />
}

export default ({ tree, onSelect }: {
    tree: TreeEnts
    onSelect?: (id: string, ent: Ent) => any
}) => {
    const meshes = tree.$meshes?.children || [],
        selected = tree.$selected?.children || [],
        active = Object.fromEntries(selected.map(item => [item, true])),
        objs = useRef({ } as Record<number, { obj: Engine.Obj3, ent: Ent, id: string }>),
        select = useRef(onSelect)
    select.current = onSelect
    return <Canvas className="view" style={{ width: '100%', height: '100%' }}>
        {
            meshes.map((id, idx) =>
                tree[id]?.checked &&
                tree[id]?.entities?.map((ent, val) =>
                    <Entity key={ idx + val * meshes.length }
                        data={ ent }
                        active={ !selected.length || !!active[id] }
                        onCreated={ obj => objs.current[obj.id] = { obj, ent, id } } />))
        }
        <MouseControl onSelect={
            obj => {
                const item = objs.current[obj.id]
                item && select.current?.(item.id, item.ent)
            }
        } />
    </Canvas>
}
