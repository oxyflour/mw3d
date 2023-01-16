import { Canvas, Engine, Mesh, Obj3, useObj3 } from '@ttk/react'
import React, { useMemo } from 'react'

import { Entity, TreeEnts } from '../../utils/data/entity'
import { TreeData, TreeNode } from '../../utils/data/tree'
import { ViewOpts } from '../../utils/data/view'
import { useAsync } from '../../utils/react/hooks'
import { KeyControl } from './control/key'
import { MouseControl } from './control/mouse'

import './index.less'
import { loadGeom, loadMatSet, MATERIAL_SET } from './loader/utils'
import { EntityPicker, TopoPicked } from './pick/entity'
import { Obj3WithEntity } from './pick/utils'
import { Axies } from './tool/axies'
import { Culling } from './tool/culling'

function EntityMeshBind({ entity }: { entity: Entity }) {
    const { obj } = useObj3() as { obj: Obj3WithEntity }
    obj && (obj.entity = entity)
    return null
}

const GEO_BOX = new Engine.BoxGeometry({ })
function MeshBound(props: EntityProps) {
    const { position, scaling } = useMemo(() => {
        const position = [0, 0, 0] as [number, number, number],
            scaling = [1, 1, 1] as [number, number, number]
        if (props.data.bound) {
            const [x0, y0, z0, x1, y1, z1] = props.data.bound
            position[0] = (x0 + x1) / 2
            position[1] = (y0 + y1) / 2
            position[2] = (z0 + z1) / 2
            scaling[0] = (x1 - x0)
            scaling[1] = (y1 - y0)
            scaling[2] = (z1 - z0)
        }
        return { position, scaling }
    }, [props.data.bound])
    const mats = useMemo(() => loadMatSet(props.data.attrs, props.view.mats), [props.data.attrs, props.view.mats])
    return <Obj3 { ...props }>
        <EntityMeshBind entity={ props.data } />
        <Mesh geo={ GEO_BOX }
            mat={ props.active ? mats.default : mats.dimmed }
            position={ position }
            scaling={ scaling }>
            <EntityMeshBind entity={ props.data } />
        </Mesh>
    </Obj3>
}

export const EDGE_MAT = new Engine.BasicMaterial({ color: [0, 0, 0], lineWidth: devicePixelRatio * 3 })
function EntityMesh(props: EntityProps) {
    const [{ value: geom }] = useAsync(async url => url ? await loadGeom(url) : { }, [props.data.geom?.url]),
        mats = useMemo(() => loadMatSet(props.data.attrs, props.view.mats), [props.data.attrs, props.view.mats])
    return geom?.faces || geom?.edges ? <>
        { geom.faces && <Mesh { ...props }
            isVisible={ props.data.attrs?.$visible }
            mat={ props.active ? mats.default : mats.dimmed }
            geo={ geom.faces }>
            <EntityMeshBind entity={ props.data } />
        </Mesh> }
        { geom.edges && <Mesh
            isVisible={ props.active && props.data?.attrs?.$visible && props.view.pick?.mode !== 'edge' }
            geo={ geom.edges } mat={ EDGE_MAT } /> }
    </> : <MeshBound { ...props } />
}

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

export default ({ tree, ents, view, setView, children, onSelect }: {
    tree: TreeEnts
    ents: Entity[]
    view: ViewOpts
    setView: (view: ViewOpts) => void
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
                const active = !selected.length || !!data.nodes?.some(id => tree[id]?.selected),
                    mat = active ? MATERIAL_SET.default : MATERIAL_SET.dimmed,
                    matrix = data.trans
                return <EntityMesh { ...{ key, view, active, data, mat, matrix } } />
            })
        }
        <Axies />
        <Culling view={ view } setView={ setView } />
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
