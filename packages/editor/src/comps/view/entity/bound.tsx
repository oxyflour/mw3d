import { Engine, Mesh, Obj3 } from "@ttk/react"
import { useMemo } from "react"
import { loadMatSet } from "../loader/utils"
import { EntityMeshBind, EntityProps } from "./utils"

const GEO_BOX = new Engine.BoxGeometry({ })
export function MeshBound(props: EntityProps) {
    const { position, scaling } = useMemo(() => {
        const position = [0, 0, 0] as [number, number, number],
            scaling = [1, 1, 1] as [number, number, number]
        if (props.data.bound) {
            const [x0, y0, z0, x1, y1, z1] = props.data.bound
            position[0] = (x0 + x1) / 2
            position[1] = (y0 + y1) / 2
            position[2] = (z0 + z1) / 2
            scaling[0] = (x1 - x0)
            scaling[1] = (y1 - y0)
            scaling[2] = (z1 - z0)
        }
        return { position, scaling }
    }, [props.data.bound])
    const mats = useMemo(() => loadMatSet(props.data.attrs, props.view.mats), [props.data.attrs, props.view.mats])
    return <Obj3 { ...props }>
        <EntityMeshBind entity={ props.data } />
        <Mesh geo={ GEO_BOX }
            mat={ props.active ? mats.default : mats.dimmed }
            position={ position }
            scaling={ scaling }>
            <EntityMeshBind entity={ props.data } />
        </Mesh>
    </Obj3>
}
