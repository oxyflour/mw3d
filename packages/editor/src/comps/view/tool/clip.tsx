import { Engine, useCanvas } from "@ttk/react"
import { useEffect } from "react"
import { ViewOpts } from "../../../utils/data/view"
import { Obj3WithEntity } from "../pick/utils"

function setClipPlane(scene: Engine.Scene, clip: [number, number, number, number]) {
    const objs = Array.from(scene).filter((item: Obj3WithEntity) => item.entity && item instanceof Engine.Mesh) as Engine.Mesh[],
        value = clip || [0, 0, 0, 0]
    for (const obj of objs) {
        if (obj.mat) {
            for (let i = 0; i < 4; i ++) {
                obj.mat.clipPlane[i] = value[i]!
            }
            console.log(obj.mat.clipPlane)
        }
    }
}
export function Clip({ view }: { view: ViewOpts }) {
    const clip = view.clipPlane?.value,
        { scene } = useCanvas()
    useEffect(() => {
        scene && setClipPlane(scene, clip || [0, 0, 0, 0])
        return () => {
            scene && setClipPlane(scene, clip || [0, 0, 0, 0])
        }
    }, [clip, scene])
    return null
}
