import { CanvasContextValue, Engine, Tool, useCanvas, Utils, Obj3, Mesh } from "@ttk/react"
import { useEffect, useRef, useState } from "react"

import lambda from "../../lambda"
import { unpack } from "../../utils/common/pack"
import { queue } from "../../utils/common/queue"
import { Entity } from "../../utils/data/entity"
import { useAsync } from "../../utils/react/hooks"
import { Edge, Face } from "../../utils/data/topo"
import { debounce } from "../../utils/common/debounce"
import { ViewPickMode } from "../../utils/data/view"

const [r = 0, g = 0, b = 0] = [1, 2, 3].map(() => Math.random())
export const MATERIAL_SET = {
    select:  new Engine.BasicMaterial({ color: [.5, 0., 0, 1], lineWidth: devicePixelRatio * 5, entry: { frag: 'fragMainColorDash' }, metallic: 2, roughness: 1 }),
    selected:new Engine.BasicMaterial({ color: [0, 1, 1, 1.0], lineWidth: devicePixelRatio * 5, entry: { frag: 'fragMainColorDash' }, metallic: 8, roughness: 6 }),
    hover:   new Engine.BasicMaterial({ color: [1, 1, 0, 1.0], lineWidth: devicePixelRatio * 5, entry: { frag: 'fragMainColorDash' }, metallic: 8, roughness: -2 }),
    default: new Engine.BasicMaterial({ color: [r, g, b, 1.0], lineWidth: devicePixelRatio * 3, emissive: 0.2 }),
    dimmed:  new Engine.BasicMaterial({ color: [r, g, b, 0.7], lineWidth: devicePixelRatio * 3 })
}

export const CAMERA_PIVOT = new Engine.Mesh(
    new Engine.SphereGeometry(),
    new Engine.BasicMaterial({
        color: [1, 0, 0, 0.5]
    }), {
        scaling: [0.1, 0.1, 0.1]
    })

export async function pick(
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

export type Obj3WithEntity = Engine.Obj3 & { entity?: Entity }
const PICK_CACHE = new Utils.LRU<Engine.Mesh[]>(100)

const pickEntity = queue(pick)
export function EntityPicker({ mode, onSelect }: {
    mode: ViewPickMode
    onSelect?: (item: { entity: Entity, index: number }) => any
}) {
    const { scene, canvas, ...ctx } = useCanvas(),
        [hover, setHover] = useState({ clientX: -1, clientY: -1, entity: undefined as undefined | Entity }),
        callback = useRef(onSelect),
        onMouseMove = useRef<(evt: MouseEvent) => any>()
    callback.current = onSelect
    onMouseMove.current = async function onMouseMove({ clientX, clientY }: MouseEvent) {
        const meshes = (Array.from(scene || []) as Obj3WithEntity[]).filter(item => item.entity),
            map = Object.fromEntries(meshes.map(mesh => [mesh.id, mesh.entity!])),
            ret = await pickEntity({ scene: new Engine.Scene(meshes), canvas, ...ctx }, { clientX, clientY })
        setHover({ clientX, clientY, entity: map[ret.id] })
    }
    useEffect(() => {
        if (canvas) {
            const onHover = (evt: MouseEvent) => onMouseMove.current?.(evt)
            canvas.addEventListener('mousemove', onHover)
            return () => canvas.removeEventListener('mousemove', onHover)
        } else {
            return () => { }
        }
    }, [canvas])
    return hover.entity &&
        <TopoPicker mode={ mode } entity={ hover.entity } pos={ hover }
            onSelect={ index => hover.entity && callback.current?.({ entity: hover.entity, index }) } /> ||
        null
}

const pickTopo = debounce(pick, 100)
async function loadFaces(entity: Entity) {
    const url = entity.topo?.faces?.url || ''
    return PICK_CACHE.get(url) || PICK_CACHE.set(url,
        (url ? unpack(await lambda.assets.get(url)) as Face[] : [])
            .map(data => new Engine.Mesh(new Engine.Geometry(data), MATERIAL_SET.select)))
}
async function loadEdges(entity: Entity) {
    const url = entity.topo?.edges?.url || ''
    return PICK_CACHE.get(url) || PICK_CACHE.set(url,
        (url ? unpack(await lambda.assets.get(url)) as Edge[] : [])
            .map(data => new Engine.Mesh(new Engine.LineList({ lines: [data.positions] }), MATERIAL_SET.select)))
}
export function TopoPicker({ mode, entity, pos, onSelect }: {
    mode: ViewPickMode
    entity: Entity
    pos: { clientX: number, clientY: number }
    onSelect?: (index: number) => any
}) {
    const [{ value: meshes = [] }] = useAsync(() => (mode === 'edge' ? loadEdges : loadFaces)(entity), [mode, entity]),
        ctx = useCanvas(),
        { canvas } = ctx,
        [hoverTopo, setHoverTopo] = useState<Engine.Mesh>(),
        onDblClick = useRef<(evt: MouseEvent) => any>()
    onDblClick.current = async evt => {
        const ret = await pick({ ...ctx, scene: new Engine.Scene(meshes) }, evt)
        onSelect?.(meshes.findIndex(mesh => mesh.id === ret.id))
    }
    useEffect(() => {
        if (meshes.length) {
            pickTopo({ ...ctx, scene: new Engine.Scene(meshes) }, pos)
                .then(ret => setHoverTopo(meshes.find(mesh => mesh.id === ret.id)))
        }
    }, [meshes, pos])
    useEffect(() => {
        if (canvas) {
            const onSelect = async (evt: MouseEvent) => onDblClick.current?.(evt)
            canvas.addEventListener('dblclick', onSelect)
            return () => canvas.removeEventListener('dblclick', onSelect)
        } else {
            return () => { }
        }
    }, [canvas])
    return <Obj3 matrix={ entity.trans }>
    {
        meshes.map(item => <Mesh key={ item.id }
            renderOrder={ -100 }
            geo={ item.geo }
            mat={
                item.id === hoverTopo?.id ? MATERIAL_SET.hover :
                mode === 'face' ? undefined :
                    item.mat
            } />)
    }
    </Obj3>
}

export function TopoSelection({ entity, type, index }: {
    entity: Entity
    type: ViewPickMode
    index: number
}) {
    const [{ value: meshes = [] }] = useAsync(() => (type === 'edge' ? loadEdges : loadFaces)(entity), [entity, type]),
        item = meshes[index]
    return item &&
        <Mesh
            renderOrder={ -10 }
            geo={ item.geo }
            mat={ MATERIAL_SET.selected } /> ||
        null
}
