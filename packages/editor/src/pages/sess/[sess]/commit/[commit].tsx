import React, { useEffect, useState } from 'react'
import { RouteMatch } from 'react-router-dom'

import Toolbar from '../../../../comps/toolbar'
import Nav from '../../../../comps/nav'
import View from '../../../../comps/view'
import Resize from '../../../../comps/utils/resize'
import { Entity, parse, TreeEntNode, TreeEnts } from '../../../../utils/data/entity'
import { ViewOpts } from '../../../../utils/data/view'
import { select, walk } from '../../../../utils/data/tree'
import { useEntities } from '..'

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

function getLeftEnts(ents: Entity[], tree: TreeEnts, id: string) {
    const set = new Set(ents)
    walk(tree, id, (_, { entities }: TreeEntNode) => {
        for (const idx of entities || []) {
            const ent = ents[idx]
            ent && set.delete(ent)
        }
    })
    return set
}

export default ({ params }: RouteMatch<'sess' | 'commit'>) => {
    const [ents, setEnts] = useEntities(params.sess, params.commit),
        [tree, setTree] = useState({ } as TreeEnts),
        [view, setView] = useState(DEFAULT_VIEWOPTS)
    useEffect(() => { setTree(parse(ents, tree)) }, [ents])
    return <div className="app flex flex-col h-full">
        <Toolbar { ...{ ents, setEnts, view, setView } } />
        <Resize className="grow">
            <Nav { ...{ tree, setTree } }
                onKeyDownOnNode={
                    (id, evt) => {
                        if (evt.key === 'Delete') {
                            const left = getLeftEnts(ents, tree, id)
                            setEnts(ents.filter(ent => left.has(ent)))
                        }
                    }
                } />
            <View { ...{ tree, view, ents, setView } }
                onSelect={
                    nodes => {
                        const selected = nodes?.filter(id => id.startsWith('Components'))
                        setTree(select(tree, selected))
                    }
                } />
        </Resize>
    </div>
}