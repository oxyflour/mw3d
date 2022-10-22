import { Engine, Mesh, Obj3, useCanvas } from "@ttk/react"
import { useEffect, useRef, useState } from "react"
import { debounce } from "../../../utils/common/debounce"
import { queue } from "../../../utils/common/queue"
import { Entity } from "../../../utils/data/entity"
import { ViewPickMode } from "../../../utils/data/view"
import { useAsync } from "../../../utils/react/hooks"
import { loadTopo, MATERIAL_SET, Obj3WithEntity, pick } from "./utils"

const pickEntity = queue(pick),
    pickTopo = debounce(pick, 100)
export function EntityPicker({ mode, pickable, onSelect }: {
    mode: ViewPickMode
    pickable?: Record<string, boolean>
    onSelect?: (item: { entity: Entity, index: number }) => any
}) {
    const { scene, ...ctx } = useCanvas(),
        { canvas } = ctx,
        [{ entity, ...position }, setHoverEntity] = useState({ entity: undefined as undefined | Entity, clientX: 0, clientY: 0 }),
        [hoverMesh, setHoverMesh] = useState<Engine.Mesh>(),
        [{ value: topos = [] }] = useAsync(async () => entity ? await loadTopo(mode, entity) : [], [mode, entity]),
        callback = useRef(onSelect),
        onMouseMove = useRef<(evt: MouseEvent) => any>(),
        onDblClick = useRef<(evt: MouseEvent) => any>()
    callback.current = onSelect
    onMouseMove.current = async function onMouseMove({ clientX, clientY }: MouseEvent) {
        const meshes = (Array.from(scene || []) as Obj3WithEntity[])
                .filter(item => pickable ? item.entity?.nodes?.some(node => pickable[node]) : item.entity)
                .concat(topos.map(mesh => Object.assign(mesh, { entity }))),
            map = Object.fromEntries(meshes.map(mesh => [mesh.id, mesh.entity!])),
            ret = await pickEntity({ scene: new Engine.Scene(meshes), ...ctx }, { clientX, clientY })
        setHoverEntity({ entity: map[ret.id], clientX, clientY })
    }
    onDblClick.current = async evt => {
        const ret = await pick({ ...ctx, scene: new Engine.Scene(topos) }, evt),
            index = topos.findIndex(mesh => mesh.id === ret.id)
        entity && index >= 0 && onSelect?.({ entity, index })
    }
    useEffect(() => {
        pickTopo({ scene: new Engine.Scene(topos), ...ctx }, position)
            .then(res => setHoverMesh(topos.find(mesh => mesh.id === res.id)))
    }, [topos, position.clientX, position.clientY])
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
    return entity && topos.length &&
        <Obj3 matrix={ entity.trans }>
        {
            topos.map(item => <Mesh key={ item.id }
                renderOrder={ item.id === hoverMesh?.id ? -100 : -5 }
                geo={ item.geo }
                mat={ item.id === hoverMesh?.id ? MATERIAL_SET.hover : item.mat } />)
        }
        </Obj3> ||
        null
}
