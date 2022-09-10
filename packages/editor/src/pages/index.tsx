import React, { useEffect, useMemo, useState } from 'react'

import Toolbar from '../comps/toolbar'
import Nav from '../comps/nav'
import View, { EntityProps, MATERIAL_SET } from '../comps/view'

import './index.less'
import Resize from '../comps/utils/resize'
import { Entity, parse, TreeEnts } from '../utils/data/entity'
import { useAsync } from '../utils/react/hooks'
import { Engine, Mesh, Obj3 } from '@ttk/react'
import { unpack } from '../utils/data/pack'
import lambda from '../lambda'

async function loadGeom(url?: string) {
    if (url) {
        const buf = await lambda.geom.get(url),
            { faces, edges } = unpack(new Uint8Array(buf))
        if (faces || edges) {
            return {
                faces: faces && new Engine.Geometry(faces),
                edges: edges && new Engine.LineList(edges),
            }
        }
    }
    return undefined
}

const GEO_BOX = new Engine.BoxGeometry({ })
function MeshBound({ create, ...props }: EntityProps) {
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
    return <Obj3 { ...props }>
        <Mesh create={ create }
            geo={ GEO_BOX }
            mat={ props.active ? MATERIAL_SET.default : MATERIAL_SET.dimmed }
            position={ position }
            scaling={ scaling } />
    </Obj3>
}

const EDGE_MAT = new Engine.BasicMaterial({ color: [0, 0, 0] })
function EntityMesh(props: EntityProps) {
    const [{ value: geom }] = useAsync(loadGeom, [props.data.geom?.url])
    return geom?.faces || geom?.edges ? <>
        { geom.faces && <Mesh { ...props } geo={ geom.faces } renderOrder={ 100 } /> }
        { geom.edges && <Mesh isVisible={ props.active } geo={ geom.edges } mat={ EDGE_MAT } /> }
    </> : <MeshBound { ...props } />
}

export default function App() {
    const [ents, setEnts] = useState([] as Entity[]),
        [tree, setTree] = useState({ } as TreeEnts)
    useEffect(() => setTree(parse(ents)), [ents])
    return <div className="app flex flex-col h-full">
        <Toolbar ents={ ents } setEnts={ setEnts } />
        <Resize className="grow">
            <Nav tree={ tree } onChange={ setTree } />
            <View tree={ tree } setTree={ setTree } ents={ ents } component={ EntityMesh } />
        </Resize>
    </div>
}
