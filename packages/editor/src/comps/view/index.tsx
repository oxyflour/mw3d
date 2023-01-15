import { Canvas, Engine, Mesh, useCanvas, useTick } from '@ttk/react'
import React, {  } from 'react'

import { Entity, TreeEnts } from '../../utils/data/entity'
import { TreeData, TreeNode } from '../../utils/data/tree'
import { ViewOpts } from '../../utils/data/view'
import { KeyControl } from './control/key'
import { MouseControl } from './control/mouse'

import './index.less'
import { EntityPicker, TopoPicked } from './pick/entity'
import { MATERIAL_SET, Obj3WithEntity, query } from './pick/utils'
import { Axies } from './tool/axies'

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

function ViewPortCulling({ view, setView }: { view: ViewOpts, setView: (view: ViewOpts) => void }) {
    const ctx = useCanvas()
    useTick(async () => {
        const objs = { } as Record<number, Engine.Obj3>,
            updateEntity = (entity: Entity, update: any) => Object.assign(entity.attrs || (entity.attrs = { }), update)
        ctx.scene?.walk((obj: Obj3WithEntity) => {
            objs[obj.id] = obj
            obj.entity && updateEntity(obj.entity, { $visible: false })
        })
        const visibleMeshes = (await query(ctx)).sort()
        for (const obj of visibleMeshes.map(id => objs[id] as Obj3WithEntity).filter(obj => obj)) {
            obj.entity && updateEntity(obj.entity, { $visible: true })
        }
        if (visibleMeshes.join(',') !== view.viewPort?.visibleMeshes?.join(',')) {
            setView({ ...view, viewPort: { ...view.viewPort, visibleMeshes } })
        }
    }, 1000)
    return null
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
    const selected = Object.keys(tree.$selected?.children || { }),
        visible = ents.filter(item => item.nodes?.length && checked(tree, item.nodes))
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
            visible.map((data, key) => {
                const active = !selected.length || data.nodes?.some(id => tree[id]?.selected),
                    mat = active ? MATERIAL_SET.default : MATERIAL_SET.dimmed,
                    matrix = data.trans
                return React.createElement(component || Mesh, { key, view, active, data, mat, matrix } as EntityProps)
            })
        }
        <Axies />
        <ViewPortCulling view={ view } setView={ setView } />
        <KeyControl view={ view } setView={ setView } />
        <MouseControl view={ view }
            onSelect={ (obj?: Obj3WithEntity) => !view.pick?.mode && onSelect?.(obj?.entity?.nodes, obj) } />
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
            view.pick?.topos && view.pick.topos.map((item, idx) => <TopoPicked key={ idx } { ...item } />)
        }
        { children }
    </Canvas>
}
