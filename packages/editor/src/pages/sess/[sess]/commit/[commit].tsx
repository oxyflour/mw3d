import React, { useEffect, useState } from 'react'
import { RouteMatch } from 'react-router-dom'

import Toolbar from '../../../../comps/toolbar'
import Nav from '../../../../comps/nav'
import View from '../../../../comps/view'
import Resize from '../../../../comps/utils/resize'
import { parse, remove, TreeEnts } from '../../../../utils/data/entity'
import { ViewOpts } from '../../../../utils/data/view'
import { select } from '../../../../utils/data/tree'
import { useEntities } from '..'
import { Group } from '../../../../comps/toolbar/utils/group'
import { ImageButton } from '../../../../comps/toolbar/utils/image-button'

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
    const [ents, setEnts] = useEntities(params.sess, params.commit),
        [tree, setTree] = useState({ } as TreeEnts),
        [view, setView] = useState(DEFAULT_VIEWOPTS)
    useEffect(() => { setTree(parse(ents, tree)) }, [ents])
    return <div className="app flex flex-col h-full">
        <Toolbar { ...{ ents, tree, view, setEnts, setView } }>
            <div title="Debug">
                <Group title="Tool">
                    <ImageButton title="TODO" />
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