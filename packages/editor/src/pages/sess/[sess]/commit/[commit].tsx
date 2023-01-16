import React, { useEffect, useState } from 'react'
import { RouteMatch } from 'react-router-dom'

import Toolbar from '../../../../comps/toolbar'
import Nav from '../../../../comps/nav'
import View from '../../../../comps/view'
import Resize from '../../../../comps/utils/resize'
import { parse, TreeEnts } from '../../../../utils/data/entity'
import { ViewOpts } from '../../../../utils/data/view'
import { select } from '../../../../utils/data/tree'
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

export default ({ params }: RouteMatch<'sess' | 'commit'>) => {
    const [ents, setEnts] = useEntities(params.sess, params.commit),
        [tree, setTree] = useState({ } as TreeEnts),
        [view, setView] = useState(DEFAULT_VIEWOPTS)
    useEffect(() => { setTree(parse(ents)) }, [ents])
    return <div className="app flex flex-col h-full">
        <Toolbar { ...{ ents, setEnts, view, setView } } />
        <Resize className="grow">
            <Nav { ...{ tree, setTree } } />
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