import { Canvas, Engine } from '@ttk/react'
import React, { useState } from 'react'

import { Entity, TreeEnts } from '../../utils/data/entity'
import { TreeData, TreeNode } from '../../utils/data/tree'
import { ViewOpts } from '../../utils/data/view'
import { KeyControl } from './control/key'
import { MouseControl } from './control/mouse'
import Clip from './entity/clip'
import { EntityMesh } from './entity/mesh'

import './index.less'
import { EntityPicker, TopoPicked } from './pick/entity'
import { Obj3WithEntity } from './pick/utils'
import { Axies } from './tool/axies'
import { Culling } from './tool/culling'
import { Transform } from './tool/transform'

function checked(tree: TreeData, nodes: string[]) {
    const ret = { } as TreeNode
    for (const id of nodes) {
        const node = tree[id]
        if (node && (node.checkedAt || 0) > (ret.checkedAt || -1)) {
            ret.checkedAt = node.checkedAt
            ret.checked = node.checked
        }
    }
    return ret.checked
}

const camera = new Engine.PerspectiveCamera({
    near: 10,
    far: 10000,
    fov: 2 / 180 * Math.PI,
    position: [0, 0, 500],
})

export default ({ tree, ents, view, setView, setEnts, children, onSelect }: {
    tree: TreeEnts
    ents: Entity[]
    view: ViewOpts
    setView: (view: ViewOpts) => void
    setEnts: (ents: Entity[]) => void
    children?: any
    onSelect?: (nodes?: string[], obj?: Engine.Obj3, evt?: MouseEvent) => any
}) => {
    const selected = Object.keys(tree.$selected?.children || { }),
        list = ents.filter(item => item.nodes?.length && checked(tree, item.nodes)),
        [visible, setVisible] = useState(new Set<Entity>())
    return <Canvas className="view"
            camera={ camera }
            style={{ width: '100%', height: '100%' }}
            options={{ sampleCount: 4 }}>
        {
            list.map((data, key) => {
                const active = !selected.length || !!data.nodes?.some(id => tree[id]?.selected),
                    matrix = data.trans,
                    isVisible = visible.has(data)
                return <EntityMesh { ...{ key, view, active, data, matrix, isVisible } } />
            })
        }
        <Axies />
        <Culling visible={ visible } setVisible={ setVisible} />
        <KeyControl { ...{ view, ents, tree, setView, setEnts } } />
        <MouseControl view={ view } onSelect={
            (obj?: Obj3WithEntity, evt?: MouseEvent) => {
                !view.pick?.mode && onSelect?.(obj?.entity?.nodes, obj, evt)
            }
        } />
        {
            view.clipPlane?.enabled &&
            <Clip view={ view } />
        }
        {
            view.pick?.mode &&
            <EntityPicker mode={ view.pick.mode }
                pickable={ selected.length ? tree.$selected?.children : undefined }
                onSelect={
                    item => {
                        const topos = view.pick?.topos || [],
                            type = view.pick?.mode!,
                            index = topos.findIndex(topo =>
                                topo.entity === item.entity &&
                                topo.type === type &&
                                topo.index === item.index)
                        if (index >= 0) {
                            topos.splice(index, 1)
                        } else {
                            topos.push({ ...item, type })
                        }
                        setView({ ...view, pick: { ...view.pick, topos } })
                    }
                } />
        }
        {
            view.pick?.topos &&
            view.pick.topos.map((item, idx) => <TopoPicked key={ idx } { ...item } />)
        }
        {
            view.transform?.entities &&
            <Transform ents={ ents } view={ view } />
        }
        { children }
    </Canvas>
}
