import { Engine, Mesh, Tool, useCanvas } from "@ttk/react"
import { vec3 } from 'gl-matrix'

import { ViewOpts } from "../../../utils/data/view"
import { useAsync } from "../../../utils/react/hooks"
import { showBuffer } from "../control/mouse"
import { Obj3WithEntity } from "../pick/utils"

export const CLIP_DIRS = {
    '+x': [ 1, 0, 0],
    '-x': [-1, 0, 0],
    '+y': [0,  1, 0],
    '-y': [0, -1, 0],
    '+z': [0, 0,  1],
    '-z': [0, 0, -1],
} as Record<string, [number, number, number]>

const CLIP_GEO = new Engine.PlaneXY({ size: 100 }),
    CLIP_MAT = new Engine.BasicMaterial({ wgsl: { frag: 'fragMainClip' } }),
    CLIP_CAMERA = new Engine.PerspectiveCamera({ })
export default function Clip({ view }: {
    view: ViewOpts
}) {
    const { dir, pos } = view.clipPlane || { },
        { scene, canvas } = useCanvas()
    useAsync(async () => {
        if (dir && canvas) {
            const list = new Engine.Scene(Array.from(scene || []).filter((item: Obj3WithEntity) => item.entity)),
                [x, y, z] = CLIP_DIRS[dir || '+x'] || [0, 0, 0]
            CLIP_CAMERA.updateIfNecessary({ })
            CLIP_CAMERA.rotateInWorld(vec3.fromValues(0, 0, 1), vec3.fromValues(x, y, z))
            const { buffer } = await Tool.Picker.clip(list, CLIP_CAMERA, { width: 500, height: 500 })
            //await showBuffer(buffer, canvas)
            showBuffer
            buffer
        }
    }, [dir, pos])
    return <Mesh matrix={ Array.from(CLIP_CAMERA.worldMatrix) } geo={ CLIP_GEO } mat={ CLIP_MAT } />
}
