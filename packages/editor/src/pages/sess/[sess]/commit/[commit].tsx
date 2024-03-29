import React, { useEffect, useState } from 'react'
import { RouteMatch } from 'react-router-dom'

import Toolbar from '../../../../comps/toolbar'
import Nav from '../../../../comps/nav'
import View from '../../../../comps/view'
import Resize from '../../../../comps/utils/resize'
import { Entity, parse, remove, TreeEnts } from '../../../../utils/data/entity'
import { ViewOpts } from '../../../../utils/data/view'
import { select } from '../../../../utils/data/tree'
import { Group } from '../../../../comps/toolbar/utils/group'
import { ImageButton } from '../../../../comps/toolbar/utils/image-button'
import { IconButton } from '../../../../comps/toolbar/utils/icon-button'
import { EntityStore } from '..'

const DEFAULT_VIEWOPTS = {
    mats: {
        PEC: {
            metal: true
        }
    },
    clipPlane: {
        enabled: false,
        dir: '+x',
        pos: 0,
        posText: '0',
    },
} as ViewOpts

export default ({ params }: RouteMatch<'sess' | 'commit'>) => {
    const [ents, setEnts] = useState([] as Entity[]),
        [tree, setTree] = useState({ } as TreeEnts),
        [view, setView] = useState(DEFAULT_VIEWOPTS)
    useEffect(() => { setTree(parse(ents, tree)) }, [ents])
    return <div className="app flex flex-col h-full">
        <EntityStore { ...{ entities: ents, setEntities: setEnts, params } } />
        <Toolbar { ...{ ents, tree, view, setEnts, setView } }>
            <div title="Debug">
                <Group title="Tool">
                    <ImageButton title="TODO" />
                    <div>
                        <IconButton icon={ <></> } title={
                            <label>
                                <input type="checkbox"
                                    onChange={ evt => (window as any).DEBUG_SHOW_PICK_BUFFER = evt.target.checked }
                                /> Show Pick Buffer
                            </label>
                        } />
                    </div>
                </Group>
                <Group title="Tool">
                    <div>
                        <div>{ Object.keys(tree.$selected?.children || { }).length } selected</div>
                        <div>{ view.pick?.topos?.length || 0 } picked</div>
                    </div>
                </Group>
            </div>
        </Toolbar>
        <Resize className="grow">
            <Nav { ...{ tree, setTree } }
                onKeyDownOnNode={
                    (id, evt) => {
                        if (evt.key === 'Delete') {
                            setEnts(remove(ents, tree, [id]))
                        }
                    }
                } />
            <View { ...{ tree, view, ents, setView, setEnts } }
                onSelect={
                    (nodes, _, evt) => {
                        const prev = evt?.ctrlKey ? Object.keys(tree.$selected?.children || { }) : [],
                            selected = prev.concat(nodes?.filter(id => id.startsWith('Components')) || [])
                        setTree(select(tree, selected))
                    }
                } />
        </Resize>
    </div>
}