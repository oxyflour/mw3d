import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { mat4, vec3 } from 'gl-matrix'

import Toolbar from './comps/toolbar'
import Nav from './comps/nav'
import View from './comps/view'
import { useSavedInt } from './utils/react/hooks'

import './index.less'
import { withMouseDown } from './utils/dom/mouse'
import { select } from './utils/data/tree'
import { Entity, parse, TreeEnts } from './utils/data/entity'

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
    const [treeWidth, setTreeWidth] = useSavedInt('saved-nav-width', 180),
        ents = useMemo(load, []),
        [tree, setTree] = useState({ } as TreeEnts)
    function onResize(evt: React.MouseEvent) {
        const startX = evt.clientX - treeWidth,
            clamp = (min: number, val: number, max: number) => Math.max(Math.min(max, val), min)
        withMouseDown(({ clientX }) => setTreeWidth(clamp(100, clientX - startX, innerWidth - 100)))
    }
    useEffect(() => setTree(parse(ents)), [ents])
    return <div className="app flex flex-col h-full">
        <Toolbar />
        <div className="grow flex">
            <div style={{ width: treeWidth }}>
                <Nav tree={ tree } onChange={ setTree } />
            </div>
            <div className="bg-gray-200 select-none cursor-col-resize"
                style={{ width: 3 }}
                onMouseDown={ onResize }>
            </div>
            <div style={{ width: `calc(100% - ${treeWidth + 5}px)` }}>
                <View tree={ tree } onSelect={
                    id => setTree(select(tree, id))
                } />
            </div>
        </div>
    </div>
}

const root = document.getElementById('root')!,
    elem = (root as any).__mounted || ((root as any).__mounted = createRoot(root))
elem.render(<App />)
