import { Mesh } from "@ttk/react"
import { Entity } from "../../../utils/data/entity"
import { ViewPickMode } from "../../../utils/data/view"
import { useAsync } from "../../../utils/react/hooks"
import { loadTopo, MATERIAL_SET } from "./utils"

export function TopoPicked({ entity, type, index }: {
    entity: Entity
    type: ViewPickMode
    index: number
}) {
    const [{ value: meshes = [] }] = useAsync(() => loadTopo(type, entity), [entity, type]),
        item = meshes[index]
    return item &&
        <Mesh
            renderOrder={ -10 }
            geo={ item.geo }
            mat={ MATERIAL_SET.selected } /> ||
        null
}
