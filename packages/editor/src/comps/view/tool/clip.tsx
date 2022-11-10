import { Engine, useCanvas } from "@ttk/react"
import { useEffect } from "react"
import { EDGE_MAT } from "../../../pages/sess/[sess]/commit/[commit]"
import { ViewOpts } from "../../../utils/data/view"
import { Obj3WithEntity } from "../pick/utils"

function setClipPlane(scene: Engine.Scene, clip: [number, number, number, number]) {
    EDGE_MAT.clip.assign(clip)
    scene.walk((obj: Obj3WithEntity) => {
        if (obj.entity && obj instanceof Engine.Mesh && obj.mat) {
            obj.mat.clip.assign(clip)
        }
    })
}
export function Clip({ view }: { view: ViewOpts }) {
    const { enabled, dir, pos = 0 } = view.clipPlane || { },
        { scene } = useCanvas()
    useEffect(() => {
        const clip = (!enabled ? [0, 0, 0, 0] :
            dir === '+x' ? [1, 0, 0, pos] :
            dir === '+y' ? [0, 1, 0, pos] :
            dir === '+z' ? [0, 0, 1, pos] :
            dir === '-x' ? [-1, 0, 0, -pos] :
            dir === '-y' ? [0, -1, 0, -pos] :
            dir === '-z' ? [0, 0, -1, -pos] :
                [0, 0, 0, 0]) as [number, number, number, number]
        scene && setClipPlane(scene, clip)
        return () => {
            scene && setClipPlane(scene, clip)
        }
    }, [enabled, dir, pos, scene])
    return null
}
