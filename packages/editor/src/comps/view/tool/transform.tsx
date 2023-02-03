import { Engine, Mesh } from "@ttk/react"
import { useEffect, useState } from "react"

import { Entity } from "../../../utils/data/entity"
import { getTransformedEntities, ViewOpts } from "../../../utils/data/view"
import { useAsync } from "../../../utils/react/hooks"
import { loadGeom } from "../loader/utils"

const PREVIEW_MAT = new Engine.BasicMaterial({
    color: [0.5, 0.5, 1.0, 0.5],
})
function PreviewEntity({ data }: {
    data: Entity
}) {
    const [{ value: geom }] = useAsync(async url => url ? await loadGeom(url) : { }, [data.geom?.url])
    return geom?.faces ? <Mesh matrix={ data.trans } mat={ PREVIEW_MAT } geo={ geom.faces } /> : null
}

export function Transform({ view, ents }: {
    view: ViewOpts
    ents: Entity[]
}) {
    const { action = 'translate' } = view.transform || { },
        v = action === 'scale' ? 1 : 0,
        { x = v, y = v, z = v } = view.transform || { },
        [list, setList] = useState([] as Entity[])
    useEffect(() => setList(Object.values(getTransformedEntities(view, ents))), [action, x, y, z])
    return <>
    {
        list.map((data, key) => <PreviewEntity key={ key } data={ data } />)
    }
    </>
}
