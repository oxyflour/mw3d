import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { mat4, vec3 } from 'gl-matrix'

import Toolbar from './comps/toolbar'
import Nav, { select } from './comps/nav'
import View, { Ent, TreeEnts } from './comps/view'
import { useSavedInt } from './utils/react/hooks'

import './index.less'
import { withMouseDown } from './utils/dom/mouse'

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
        ...Array(5).fill(0).map((_, i) => ({ attrs: { $n: `b/${i}` }, trans: randomPosition() }) as Ent)
    ] as Ent[]
}

function parse(ents: Ent[]) {
    const meshes = { } as Record<string, boolean>,
        tree = { } as TreeEnts
    for (const ent of ents) {
        const { attrs = { } } = ent,
            { $n = '' } = attrs,
            split = $n.split('/')
        if (split.some(item => item.startsWith('.'))) {
            continue
        }

        const prefix = ['$root', ...Array(split.length).fill(0).map((_, i) => split.slice(0, i + 1).join('/'))]
        for (let i = 0; i < prefix.length - 1; i ++) {
            const dir = prefix[i]!,
                parent = tree[dir] || (tree[dir] = { checked: true, title: split[i - 1]! }),
                children = parent.children || (parent.children = []),
                key = prefix[i + 1]!,
                node = tree[key] || (children.push(key), (tree[key] = { checked: true, title: split[i]! }))
            if (i === split.length - 1) {
                const entities = node.entities || (node.entities = [])
                entities.push(ent)
                meshes[key] = true
            }
        }
    }
    tree.$meshes = { children: Object.keys(meshes) }
    return tree
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
