import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { mat4, vec3 } from 'gl-matrix'

import Toolbar from './comps/toolbar'
import Nav from './comps/nav'
import View from './comps/view'

import './index.less'
import { select } from './utils/data/tree'
import { Entity, parse, TreeEnts } from './utils/data/entity'
import Resize from './comps/utils/resize'

const m = mat4.create(),
    v = vec3.create()
function randomPosition() {
    vec3.set(v, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5)
    mat4.fromTranslation(m, v)
    return m.slice()
}

function load() {
    return [
        { attrs: { $n: 'a/1' } },
        { attrs: { $n: 'a/2' } },
        ...Array(5).fill(0).map((_, i) => ({ attrs: { $n: `b/${i}` }, trans: randomPosition() }) as Entity)
    ] as Entity[]
}

function App() {
    const ents = useMemo(load, []),
        [tree, setTree] = useState({ } as TreeEnts)
    useEffect(() => setTree(parse(ents)), [ents])
    return <div className="app flex flex-col h-full">
        <Toolbar />
        <Resize className="grow">
            <Nav tree={ tree } onChange={ setTree } />
            <View tree={ tree } onSelect={
                id => setTree(select(tree, id))
            } />
        </Resize>
    </div>
}

const root = document.getElementById('root')!,
    elem = (root as any).__mounted || ((root as any).__mounted = createRoot(root))
elem.render(<App />)
