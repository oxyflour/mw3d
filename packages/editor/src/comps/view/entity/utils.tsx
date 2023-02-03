import { Mesh, useObj3 } from "@ttk/react"
import { Entity } from "../../../utils/data/entity"
import { ViewOpts } from "../../../utils/data/view"
import { Obj3WithEntity } from "../pick/utils"

type CompProp<T> = T extends (...args: [infer A]) => any ? A : never
export type EntityProps = CompProp<typeof Mesh> & { view: ViewOpts, data: Entity, active: boolean }

export function EntityMeshBind({ entity }: { entity: Entity }) {
    const { obj } = useObj3() as { obj: Obj3WithEntity }
    obj && (obj.entity = entity)
    return null
}
