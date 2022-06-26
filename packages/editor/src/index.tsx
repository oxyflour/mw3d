import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { mat4, vec3 } from 'gl-matrix'

import Toolbar from './comps/toolbar'
import Nav from './comps/nav'
import View, { EntityProps } from './comps/view'

import './index.less'
import Resize from './comps/utils/resize'
import { select } from './utils/data/tree'
import { Entity, parse, TreeEnts } from './utils/data/entity'
import { useAsync } from './utils/react/hooks'
import { Engine, Mesh } from '@ttk/react'

const m = mat4.create(),
    v = vec3.create()
function randomPosition() {
    vec3.set(v, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5)
    mat4.fromTranslation(m, v)
    return m.slice()
}

async function load() {
    return [
        ...Array(30).fill(0)
            .map((_, i) => ({ attrs: { $n: `b/${i}` }, trans: randomPosition() }) as Entity)
    ] as Entity[]
}

const geo = new Engine.BoxGeometry({ })
function EntityMesh(props: EntityProps) {
    return <Mesh { ...props } geo={ geo } />
}

function App() {
    const [{ value: ents = [] }] = useAsync(load, [], []),
        [tree, setTree] = useState({ } as TreeEnts)
    useEffect(() => setTree(parse(ents)), [ents])
    function selectEntity(ent?: Entity) {
        const nodes = ent?.nodes?.filter(id => id.startsWith('Components'))
        setTree(select(tree, nodes))
    }
    return <div className="app flex flex-col h-full">
        <Toolbar />
        <Resize className="grow">
            <Nav tree={ tree } onChange={ setTree } />
            <View tree={ tree } ents={ ents }
                meshComponent={ EntityMesh }
                onSelect={ selectEntity } />
        </Resize>
    </div>
}

const root = document.getElementById('root')!,
    elem = (root as any).__mounted || ((root as any).__mounted = createRoot(root))
elem.render(<App />)
