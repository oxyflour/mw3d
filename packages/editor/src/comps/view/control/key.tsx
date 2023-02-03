import { Engine, Tool, useCanvas } from "@ttk/react"
import { useEffect, useRef } from "react"
import { vec3 } from 'gl-matrix'

import { ViewOpts } from "../../../utils/data/view"
import { KeyBinding, KeyMap } from "../../../utils/dom/keys"
import { Obj3WithEntity } from "../pick/utils"
import { Entity, remove, TreeEnts } from "../../../utils/data/entity"

async function alignCamera(scene: Engine.Scene, camera: Engine.PerspectiveCamera) {
    const objs = new Engine.Scene(Array.from(scene).filter(item => (item as Obj3WithEntity).entity)),
        { world: { center }, ndc: { size } } = await Tool.Picker.bound(objs, camera),
        scale = Math.max(size[0] / 2, size[1] / 2),
        dir = vec3.sub(vec3.create(), center, camera.worldPosition as vec3),
        source = vec3.normalize(vec3.create(), dir),
        target = camera.getWorldDirFromNDC(vec3.fromValues(0, 0, -1)),
        next = vec3.scaleAndAdd(vec3.create(), center, dir, -scale)
    camera.rotateInWorld(source, target)
    camera.targetToWorld(center, next)
}

export function KeyControl({ view, ents, tree, setView, setEnts }: {
    view: ViewOpts
    ents: Entity[]
    tree: TreeEnts
    setView: (view: ViewOpts) => void
    setEnts: (ents: Entity[]) => void
}) {
    const { canvas, scene, camera } = useCanvas(),
        map = useRef({ } as KeyMap),
        updatePick = (pick: ViewOpts['pick']) => setView({ ...view, pick: { ...view.pick, ...pick } })
    useEffect(() => {
        if (canvas) {
            const binding = new KeyBinding(canvas)
            binding.load(map.current)
            return () => binding.destroy()
        } else {
            return () => { }
        }
    }, [canvas])
    Object.assign(map.current, {
        p: down => !down && updatePick({ mode: 'vert' }),
        f: down => !down && updatePick({ mode: 'face' }),
        e: down => !down && updatePick({ mode: 'edge' }),
        d: down => !down && updatePick({ topos: [] }),
        Space: down => !down && scene && camera && alignCamera(scene, camera),
        Escape: down => !down && updatePick({ mode: undefined }),
        Delete: down => !down && setEnts(remove(ents, tree, Object.keys(tree.$selected?.children || { })))
    } as KeyMap)
    return null
}

