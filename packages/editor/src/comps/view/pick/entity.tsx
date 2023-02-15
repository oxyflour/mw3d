import { CanvasContextValue, Engine, Mesh, Obj3, useCanvas } from "@ttk/react"
import { useEffect, useRef, useState } from "react"
import { debounce } from "../../../utils/common/debounce"
import { Entity } from "../../../utils/data/entity"
import { ViewPickMode } from "../../../utils/data/view"
import { useAsync } from "../../../utils/react/hooks"
import { loadGeom, MATERIAL_SET } from "../loader/utils"
import { loadVertGeom, loadTopo, Obj3WithEntity, pick } from "./utils"

async function pickTopo(topos: Engine.Mesh[], ctx: CanvasContextValue, position: { clientX: number, clientY: number }) {
    const res = await pick({ scene: new Engine.Scene(topos), ...ctx }, position)
    return topos.find(mesh => mesh.id === res.id)
}
async function loadSelection(mode: ViewPickMode, entity: Entity) {
    const topos = await loadTopo(mode, entity),
        geom =
            mode === 'edge' ? (entity.geom?.url ?
                (await loadGeom(entity.geom.url)).edges : undefined) :
            mode === 'vert' ? (entity.topo?.verts?.url ?
                (await loadVertGeom(entity.topo.verts.url)).geo : undefined) :
            undefined
    return { topos, geom }
}

export function EntityPicker({ mode, pickable, onSelect }: {
    mode: ViewPickMode
    pickable?: Record<string, boolean>
    onSelect?: (item: { entity: Entity, index: number }) => any
}) {
    const { scene, ...ctx } = useCanvas(),
        { canvas } = ctx,
        [{ entity, ...position }, setHoverEntity] = useState({ entity: undefined as undefined | Entity, clientX: 0, clientY: 0 }),
        [{ value: selection }] = useAsync(async () => entity ? await loadSelection(mode, entity) : undefined, [mode, entity]),
        [{ value: hoverMesh }, { setValue: setHoverMesh }] = useAsync(async () => topos && await pickTopo(topos, ctx, position), [selection?.topos, position.clientX, position.clientY]),
        { topos, geom } = selection || { },
        callback = useRef(onSelect),
        onMouseMove = useRef<(evt: MouseEvent) => any>(),
        onDblClick = useRef<(evt: MouseEvent) => any>()
    callback.current = onSelect
    onMouseMove.current = async ({ clientX, clientY }) => {
        const meshes = (Array.from(scene || []) as Obj3WithEntity[])
                .filter(item => pickable ? item.entity?.nodes?.some(node => pickable[node]) : item.entity)
                .concat(topos?.map(mesh => Object.assign(mesh, { entity })) || []),
            map = Object.fromEntries(meshes.map(mesh => [mesh.id, mesh.entity!])),
            ret = await pick({ scene: new Engine.Scene(meshes), ...ctx }, { clientX, clientY })
        setHoverEntity({ entity: map[ret.id], clientX, clientY })
    }
    onDblClick.current = async ({ clientX, clientY }) => {
        const ret = await pick({ ...ctx, scene: new Engine.Scene(topos) }, { clientX, clientY }),
            index = (topos || []).findIndex(mesh => mesh.id === ret.id)
        entity && index >= 0 && onSelect?.({ entity, index })
        setHoverMesh(undefined)
    }
    useEffect(() => {
        if (canvas) {
            const onHover = debounce((evt: MouseEvent) => onMouseMove.current?.(evt), 50),
                onSelect = (evt: MouseEvent) => onDblClick.current?.(evt)
            canvas.addEventListener('mousemove', onHover)
            canvas.addEventListener('dblclick', onSelect)
            return () => {
                canvas.removeEventListener('mousemove', onHover)
                canvas.removeEventListener('dblclick', onSelect)
            }
        } else {
            return () => { }
        }
    }, [canvas])
    return entity &&
        <Obj3 matrix={ entity.trans }>
        {
            geom && <Mesh
                geo={ geom }
                mat={ MATERIAL_SET.select } />
        }
        {
            hoverMesh && <Mesh
                geo={ hoverMesh.geo }
                mat={ MATERIAL_SET.hover }
                offset={ hoverMesh.offset }
                count={ hoverMesh.count } />
        }
        </Obj3> ||
        null
}

export function TopoPicked({ entity, type, index }: {
    entity: Entity
    type: ViewPickMode
    index: number
}) {
    const [{ value: meshes = [] }] = useAsync(() => loadTopo(type, entity), [entity, type]),
        item = meshes[index]
    return item &&
        <Mesh
            geo={ item.geo }
            mat={ MATERIAL_SET.selected }
            offset={ item.offset }
            count={ item.count } /> ||
        null
}
