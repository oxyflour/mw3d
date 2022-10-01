import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Engine, Mesh, Obj3, Utils } from '@ttk/react'

import Toolbar from '../../comps/toolbar'
import Nav from '../../comps/nav'
import View, { EntityProps, MATERIAL_SET } from '../../comps/view'
import Resize from '../../comps/utils/resize'
import worker from '../../utils/data/worker'
import { Entity, parse, TreeEnts } from '../../utils/data/entity'
import { useAsync } from '../../utils/react/hooks'
import { ViewOpts } from '../../utils/data/view'
import { select } from '../../utils/data/tree'
import { RouteMatch } from 'react-router'

async function loadGeom(url?: string) {
    if (url) {
        const { faces, edges } = await worker.assets.get(url)
        if (faces || edges) {
            return {
                faces: faces && new Engine.Geometry(faces),
                edges: edges && new Engine.LineList(edges),
            }
        }
    }
    return undefined
}

const MATERIAL_CACHE = new Utils.LRU<{ default: Engine.Material, dimmed: Engine.Material }>()
function loadMatSet(attrs: Entity['attrs'], mats: ViewOpts['mats']) {
    const mat = attrs?.$m || 'default',
        rgb = attrs?.$rgb || mats?.[mat]?.rgb,
        metal = mats?.[mat]?.metal
    if (rgb) {
        const { r, g, b } = rgb,
            metallic  = metal ? 1.0 : 0.1,
            roughness = metal ? 0.2 : 0.8,
            key = [r, g, b, metal].join(','),
            { opts } = MATERIAL_SET.default
        return MATERIAL_CACHE.get(key) || MATERIAL_CACHE.set(key, {
            default: new Engine.BasicMaterial({ ...opts, metallic, roughness, color: [r, g, b, 1.0] }),
            dimmed:  new Engine.BasicMaterial({ ...opts, metallic, roughness, color: [r, g, b, 0.4] }),
        })
    } else {
        return MATERIAL_SET
    }
}

const GEO_BOX = new Engine.BoxGeometry({ })
function MeshBound({ create, ...props }: EntityProps) {
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
        <Mesh create={ create }
            geo={ GEO_BOX }
            mat={ props.active ? mats.default : mats.dimmed }
            position={ position }
            scaling={ scaling } />
    </Obj3>
}

const EDGE_MAT = new Engine.BasicMaterial({ color: [0, 0, 0], lineWidth: devicePixelRatio * 3 })
function EntityMesh(props: EntityProps) {
    const [{ value: geom }] = useAsync(loadGeom, [props.data.geom?.url]),
        mats = useMemo(() => loadMatSet(props.data.attrs, props.view.mats), [props.data.attrs, props.view.mats])
    return geom?.faces || geom?.edges ? <>
        { geom.faces && <Mesh { ...props }
            mat={ props.active ? mats.default : mats.dimmed }
            geo={ geom.faces } /> }
        { geom.edges && <Mesh
            isVisible={ props.active && props.view.pick?.mode !== 'edge' }
            geo={ geom.edges } mat={ EDGE_MAT } /> }
    </> : <MeshBound { ...props } />
}

const DEFAULT_VIEWOPTS = {
    mats: {
        PEC: {
            metal: true
        }
    }
} as ViewOpts

export default ({ params }: RouteMatch<'commit'>) => {
    const [ents, setEntsNow] = useState([] as Entity[]),
        [tree, setTree] = useState({ } as TreeEnts),
        [view, setView] = useState(DEFAULT_VIEWOPTS),
        nav = useNavigate()
    function setEnts(ents: Entity[]) {
        worker.sha256(ents).then(commit => {
            localStorage.setItem(`/commit/${commit}`, JSON.stringify(ents))
            nav(`/commit/${commit}`)
        })
    }
    useEffect(() => {
        const { commit } = params,
            saved = commit && localStorage.getItem(`/commit/${commit}`)
        if (saved) {
            setEntsNow(JSON.parse(saved))
        }
    }, [params.commit])
    useEffect(() => {
        setTree(parse(ents))
    }, [ents])
    return <div className="app flex flex-col h-full">
        <Toolbar { ...{ ents, setEnts, view, setView } } />
        <Resize className="grow">
            <Nav { ...{ tree, setTree } } />
            <View { ...{ tree, view, ents, setView } }
                component={ EntityMesh }
                onSelect={
                    nodes => {
                        const selected = nodes?.filter(id => id.startsWith('Components'))
                        setTree(select(tree, selected))
                    }
                } />
        </Resize>
    </div>
}