import { Engine, Mesh } from "@ttk/react"
import { useMemo } from "react"
import { useAsync } from "../../../utils/react/hooks"
import { loadGeom, loadMatSet } from "../loader/utils"
import { MeshBound } from "./bound"
import { EntityMeshBind, EntityProps } from "./utils"

const CLIP_DIRS = {
    '+x': [ 1, 0, 0],
    '-x': [-1, 0, 0],
    '+y': [0,  1, 0],
    '-y': [0, -1, 0],
    '+z': [0, 0,  1],
    '-z': [0, 0, -1],
} as Record<string, number[]>

export const EDGE_MAT = new Engine.BasicMaterial({ color: [0, 0, 0], lineWidth: devicePixelRatio * 3 })
export function EntityMesh(props: EntityProps) {
    const [{ value: geom }] = useAsync(async url => url ? await loadGeom(url) : { }, [props.data.geom?.url]),
        mats = useMemo(() => loadMatSet(props.data.attrs, props.view.mats), [props.data.attrs, props.view.mats]),
        mat = props.active ? mats.default : mats.dimmed
    for (const item of [mat, EDGE_MAT]) {
        if (props.view.clipPlane?.enabled) {
            const dir = CLIP_DIRS[props.view.clipPlane.dir || '+x'] || []
            item.clip.assign(dir.concat(props.view.clipPlane.pos || 0))
        } else if (item.needsClip) {
            item.clip.assign([0, 0, 0, 0])
        }
    }
    return geom?.faces || geom?.edges ? <>
        { geom.faces && <Mesh
            { ...props }
            mat={ mat }
            geo={ geom.faces }>
            <EntityMeshBind entity={ props.data } />
        </Mesh> }
        { geom.edges && <Mesh
            isVisible={ props.active && props.isVisible && props.view.pick?.mode !== 'edge' }
            matrix={ props.matrix }
            mat={ EDGE_MAT }
            geo={ geom.edges } /> }
    </> : <MeshBound { ...props } />
}
