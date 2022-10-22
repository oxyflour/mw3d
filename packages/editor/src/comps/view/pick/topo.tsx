import { Engine, Mesh, Obj3, useCanvas } from "@ttk/react"
import { useEffect, useRef, useState } from "react"
import { debounce } from "../../../utils/common/debounce"
import { Entity } from "../../../utils/data/entity"
import { ViewPickMode } from "../../../utils/data/view"
import { MATERIAL_SET, pick } from "./utils"

const pickTopo = debounce(pick, 100)

export function TopoPicker({ mode, entity, meshes, pos, onSelect }: {
    mode: ViewPickMode
    entity: Entity
    meshes: Engine.Mesh[]
    pos: { clientX: number, clientY: number }
    onSelect?: (index: number) => any
}) {
    const ctx = useCanvas(),
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
            renderOrder={ item.id === hoverTopo?.id ? -100 : -5 }
            geo={ item.geo }
            mat={
                item.id === hoverTopo?.id ? MATERIAL_SET.hover :
                mode === 'face' ? undefined :
                    item.mat
            } />)
    }
    </Obj3>
}
