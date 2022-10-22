import { Engine, useCanvas } from "@ttk/react"
import { useEffect, useRef, useState } from "react"
import { debounce } from "../../../utils/common/debounce"
import { queue } from "../../../utils/common/queue"
import { Entity } from "../../../utils/data/entity"
import { ViewPickMode } from "../../../utils/data/view"
import { useAsync } from "../../../utils/react/hooks"
import { TopoPicker } from "./topo"
import { loadEdges, loadFaces, Obj3WithEntity, pick } from "./utils"

const pickEntity = queue(pick)
export function EntityPicker({ mode, onSelect }: {
    mode: ViewPickMode
    onSelect?: (item: { entity: Entity, index: number }) => any
}) {
    const { scene, canvas, ...ctx } = useCanvas(),
        [hover, setHover] = useState({ clientX: -1, clientY: -1 }),
        [entity, setEntity] = useState<Entity>(),
        [{ value: topos = [] }] = useAsync(async () => entity ? await (mode === 'edge' ? loadEdges : loadFaces)(entity) : [], [mode, entity]),
        callback = useRef(onSelect),
        onMouseMove = useRef<(evt: MouseEvent) => any>()
    callback.current = onSelect
    onMouseMove.current = async function onMouseMove({ clientX, clientY }: MouseEvent) {
        const meshes = (Array.from(scene || []) as Obj3WithEntity[]).filter(item => item.entity).concat(topos.map(mesh => Object.assign(mesh, { entity }))),
            map = Object.fromEntries(meshes.map(mesh => [mesh.id, mesh.entity!])),
            ret = await pickEntity({ scene: new Engine.Scene(meshes), canvas, ...ctx }, { clientX, clientY })
        setEntity(map[ret.id])
        setHover({ clientX, clientY })
    }
    useEffect(() => {
        if (canvas) {
            const onHover = debounce((evt: MouseEvent) => onMouseMove.current?.(evt), 50)
            canvas.addEventListener('mousemove', onHover)
            return () => canvas.removeEventListener('mousemove', onHover)
        } else {
            return () => { }
        }
    }, [canvas])
    return entity &&
        <TopoPicker mode={ mode } entity={ entity } meshes={ topos } pos={ hover }
            onSelect={ index => entity && callback.current?.({ entity, index }) } /> ||
        null
}
