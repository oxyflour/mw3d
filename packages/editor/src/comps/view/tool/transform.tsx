import { Engine, Mesh } from "@ttk/react"
import { useEffect, useState } from "react"
import { mat4, vec3 } from 'gl-matrix'

import { Entity } from "../../../utils/data/entity"
import { ViewOpts } from "../../../utils/data/view"
import { useAsync } from "../../../utils/react/hooks"
import { loadGeom } from "../loader/utils"

const PREVIEW_MAT = new Engine.BasicMaterial({
    color: [0.5, 0.5, 1.0, 0.5],
})
function PreviewEntity({ data, matrix }: {
    data: Entity
    matrix: mat4
}) {
    const [{ value: geom }] = useAsync(async url => url ? await loadGeom(url) : { }, [data.geom?.url]),
        trans = mat4.create()
    data.trans && mat4.copy(trans, data.trans as any)
    mat4.multiply(trans, trans, matrix)
    return geom?.faces ? <Mesh
        matrix={ Array.from(trans) }
        mat={ PREVIEW_MAT }
        geo={ geom.faces }>
    </Mesh> : null
}

const INIT_MAT = mat4.create()
export function Transform({ view }: {
    view: ViewOpts
}) {
    const { entities, action = 'translate', x = 0, y = 0, z = 0 } = view.transform || { },
        [matrix, setMatrix] = useState(INIT_MAT)
    useEffect(() => {
        const mat = mat4.create()
        if (action === 'translate') {
            mat4.fromTranslation(mat, vec3.fromValues(x, y, z))
        } else if (action === 'rotate') {
            mat4.rotateX(mat, mat, x)
            mat4.rotateY(mat, mat, y)
            mat4.rotateZ(mat, mat, z)
        } else if (action === 'scale') {
            mat4.fromScaling(mat, vec3.fromValues(x, y, z))
        }
        setMatrix(mat)
    }, [action, x, y, z])
    return <>
    {
        entities && Object.values(entities || { })
            .map((data, key) => <PreviewEntity key={ key } data={ data } matrix={ matrix } />)
    }
    </>
}
