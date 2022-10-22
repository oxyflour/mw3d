import { Canvas, Engine, Mesh } from '@ttk/react'
import React, {  } from 'react'

import { Entity, TreeEnts } from '../../utils/data/entity'
import { TreeData, TreeNode } from '../../utils/data/tree'
import { ViewOpts } from '../../utils/data/view'
import { KeyControl } from './control/key'
import { MouseControl } from './control/mouse'

import './index.less'
import { EntityPicker } from './pick/entity'
import { TopoPicked } from './pick/picked'
import { MATERIAL_SET, Obj3WithEntity } from './pick/utils'

type CompProp<T> = T extends (...args: [infer A]) => any ? A : never
export type EntityProps = CompProp<typeof Mesh> & { view: ViewOpts, data: Entity, active: boolean }

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

export default ({ tree, ents, view, setView, component, children, onSelect }: {
    tree: TreeEnts
    ents: Entity[]
    view: ViewOpts
    setView: (view: ViewOpts) => void
    component?: (props: EntityProps) => JSX.Element
    children?: any
    onSelect?: (nodes?: string[], obj?: Engine.Obj3) => any
}) => {
    const selected = Object.keys(tree.$selected?.children || { })
    return <Canvas className="view"
            style={{ width: '100%', height: '100%' }}
            options={
                canvas => {
                    // TODO: set context menu
                    canvas.oncontextmenu = () => false
                    return { }
                }
            }>
        {
            ents.map((data, key) => {
                const nodes = data.nodes || []
                if (nodes.length > 0 && checked(tree, nodes)) {
                    const active = !selected.length || nodes.some(id => tree[id]?.selected),
                        mat = active ? MATERIAL_SET.default : MATERIAL_SET.dimmed,
                        matrix = data.trans,
                        create = () => Object.assign(new Engine.Mesh(), { entity: data })
                    return React.createElement(component || Mesh, { key, view, active, data, mat, matrix, create } as EntityProps)
                } else {
                    return null
                }
            })
        }
        <KeyControl view={ view } setView={ setView } />
        <MouseControl onSelect={ (obj?: Obj3WithEntity) => !view.pick?.mode && onSelect?.(obj?.entity?.nodes, obj) } />
        {
            view.pick?.mode &&
            <EntityPicker mode={ view.pick.mode } onSelect={
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
            view.pick?.topos && view.pick.topos.map((item, idx) => <TopoPicked key={ idx } { ...item } />)
        }
        { children }
    </Canvas>
}
