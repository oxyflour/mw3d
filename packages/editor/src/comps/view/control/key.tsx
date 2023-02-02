import { Engine, Tool, useCanvas } from "@ttk/react"
import { useEffect, useRef } from "react"
import { vec3 } from 'gl-matrix'

import { ViewOpts } from "../../../utils/data/view"
import { KeyBinding, KeyMap } from "../../../utils/dom/keys"
import { Obj3WithEntity } from "../pick/utils"

export function KeyControl({ view, setView }: { view: ViewOpts, setView: (view: ViewOpts) => void }) {
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
    async function alignCamera() {
        if (scene && camera) {
            const objs = new Engine.Scene(Array.from(scene).filter(item => (item as Obj3WithEntity).entity)),
                { world: { center }, ndc: { size } } = await Tool.Picker.bound(objs, camera),
                scale = Math.max(size[0] / 2, size[1] / 2),
                dir = vec3.sub(vec3.create(), center, camera.worldPosition as vec3),
                source = vec3.normalize(vec3.create(), dir),
                target = camera.getWorldDirFromNDC(vec3.fromValues(0, 0, -1)),
                next = vec3.add(center, center, vec3.scale(dir, dir, -scale))
            camera.rotateInWorld(source, target)
            camera.setWorldPosition(next)
        }
    }
    Object.assign(map.current, {
        p: down => !down && updatePick({ mode: 'vert' }),
        f: down => !down && updatePick({ mode: 'face' }),
        e: down => !down && updatePick({ mode: 'edge' }),
        d: down => !down && updatePick({ topos: [] }),
        Space: down => !down && alignCamera(),
        Escape: down => !down && updatePick({ mode: undefined }),
    } as KeyMap)
    return null
}

