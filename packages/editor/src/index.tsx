import { createRoot } from 'react-dom/client'

import Toolbar from './comps/toolbar'
import Tree from './comps/tree'
import View from './comps/view'
import { useSavedInt } from './utils/react/hooks'

import './index.less'
import React from 'react'
import { withMouseDown } from './utils/dom/mouse'

function App() {
    const [treeWidth, setTreeWidth] = useSavedInt('saved-tree-width', 180)
    function onResize(evt: React.MouseEvent) {
        const startX = evt.clientX - treeWidth,
            clamp = (min: number, val: number, max: number) => Math.max(Math.min(max, val), min)
        withMouseDown(({ clientX }) => setTreeWidth(clamp(100, clientX - startX, innerWidth - 100)))
    }
    return <div className="app flex flex-col h-full">
        <Toolbar />
        <div className="grow flex">
            <div className="bg-stone-500" style={{ width: treeWidth }}>
                <Tree />
            </div>
            <div className="bg-black select-none cursor-col-resize" style={{ width: 5 }}
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
