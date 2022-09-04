import React, { useEffect, useState } from 'react'
import { mat4, vec3 } from 'gl-matrix'

import Toolbar from '../comps/toolbar'
import Nav from '../comps/nav'
import View, { EntityProps } from '../comps/view'

import './index.less'
import Resize from '../comps/utils/resize'
import { Entity, parse, TreeEnts } from '../utils/data/entity'
import { useAsync } from '../utils/react/hooks'
import { Engine, Mesh, Obj3 } from '@ttk/react'
import { unpack } from '../utils/data/pack'

const m = mat4.create(),
    v = vec3.create()
function randomPosition() {
    vec3.set(v, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5)
    mat4.fromTranslation(m, v)
    return m.slice()
}

async function loadEnts() {
    return [
        ...Array(30).fill(0).map((_, i) => ({
            attrs: { $n: `b/${i}` },
            trans: randomPosition(),
            bound: [-1, -1, -1, 1, 1, 1],
            geom: {
                url: ''
            }
        }) as Entity)
    ] as Entity[]
}

type ClassArg0<F> = F extends new (...args: [infer A]) => any ? A : F
type GeometryOptions = ClassArg0<Engine.Geometry>
async function loadGeom(url?: string) {
    if (url) {
        const req = await fetch(url),
            buf = await req.arrayBuffer(),
            { faces, edges } = unpack(new Uint8Array(buf)) as { faces?: GeometryOptions, edges?: GeometryOptions }
        if (faces || edges) {
            return {
                faces: faces && new Engine.Geometry(faces),
                edges: edges && new Engine.Geometry(edges),
            }
        }
    }
    return undefined
}

const GEO_BOX = new Engine.BoxGeometry({ })
function MeshBound(props: EntityProps) {
    const position = [0, 0, 0] as [number, number, number],
        scaling = [1, 1, 1] as [number, number, number]
    if (props.data.geom?.bound) {
        const [x0, y0, z0, x1, y1, z1] = props.data.geom.bound
        position[0] = (x0 + x1) / 2
        position[1] = (y0 + y1) / 2
        position[2] = (z0 + z1) / 2
        scaling[0] = (x1 - x0)
        scaling[1] = (y1 - y0)
        scaling[2] = (z1 - z0)
    }
    return <Obj3 { ...props }>
        <Mesh onCreated={ props.onCreated as any }
            geo={ GEO_BOX }
            mat={ props.mat }
            position={ position }
            scaling={ scaling } />
    </Obj3>
}
function EntityMesh(props: EntityProps) {
    const [{ value: geom }] = useAsync(loadGeom, [props.data.geom?.url])
    return geom?.faces ?
        <Mesh { ...props } geo={ geom.faces }>
            { geom.edges && <Mesh isVisible={ props.active } geo={ geom.edges } /> }
        </Mesh> :
        <MeshBound { ...props } />
}

export default function App() {
    const [{ value: ents = [] }] = useAsync(loadEnts, [], []),
        [tree, setTree] = useState({ } as TreeEnts)
    useEffect(() => setTree(parse(ents)), [ents])
    return <div className="app flex flex-col h-full">
        <Toolbar />
        <Resize className="grow">
            <Nav tree={ tree } onChange={ setTree } />
            <View tree={ tree } setTree={ setTree } ents={ ents }
                meshComponent={ EntityMesh } />
        </Resize>
    </div>
}
