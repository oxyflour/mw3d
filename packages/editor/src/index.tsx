import { createRoot } from 'react-dom/client'

import Toolbar from './comps/toolbar'
import Nav, { TreeData } from './comps/nav'
import View from './comps/view'
import { useSavedInt } from './utils/react/hooks'

import './index.less'
import React, { useState } from 'react'
import { withMouseDown } from './utils/dom/mouse'

const tree = {
    '': { title: 'Roo', children: ['a', 'b'] },
    'a': { title: 'a', children: ['a/1', 'a/2'] },
    'a/1': { title: '1' },
    'a/2': { title: '2' },
    'b': { title: 'b' },
} as TreeData

function App() {
    const [treeWidth, setTreeWidth] = useSavedInt('saved-nav-width', 180)
    function onResize(evt: React.MouseEvent) {
        const startX = evt.clientX - treeWidth,
            clamp = (min: number, val: number, max: number) => Math.max(Math.min(max, val), min)
        withMouseDown(({ clientX }) => setTreeWidth(clamp(100, clientX - startX, innerWidth - 100)))
    }
    return <div className="app flex flex-col h-full">
        <Toolbar />
        <div className="grow flex">
            <div style={{ width: treeWidth }}>
                <Nav tree={ tree } />
            </div>
            <div className="bg-gray-200 select-none cursor-col-resize"
                style={{ width: 3 }}
                onMouseDown={ onResize }>
            </div>
            <div style={{ width: `calc(100% - ${treeWidth + 5}px)` }}>
                <View />
            </div>
        </div>
    </div>
}

const root = document.getElementById('root')!,
    elem = (root as any).__mounted || ((root as any).__mounted = createRoot(root))
elem.render(<App />)
