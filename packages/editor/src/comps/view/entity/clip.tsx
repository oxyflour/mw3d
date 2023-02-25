import { Texture } from "@ttk/core/dist/engine"
import { Engine, Mesh, Tool, useCanvas } from "@ttk/react"
import { vec3, mat4 } from 'gl-matrix'
import { useState } from "react"

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
    CLIP_MAT = new Engine.BasicMaterial({
        // wgsl: { frag: 'fragMainClip' },
    }),
    CLIP_CAMERA = new Engine.Camera()
export default function Clip({ view }: {
    view: ViewOpts
}) {
    const { dir, pos } = view.clipPlane || { },
        { scene, canvas } = useCanvas(),
        [trans, setTrans] = useState<mat4>()
    useAsync(async () => {
        const [x, y, z] = CLIP_DIRS[dir || '+x'] || [0, 0, 0],
            src = vec3.fromValues(0, 0, -1),
            dst = vec3.fromValues(x, y, z),
            scale = -(pos || 0) / (x * x + y * y + z * z),
            offset = vec3.fromValues(x * scale, y * scale, z * scale),
            mat = mat4.fromTranslation(mat4.create(), offset)
        CLIP_CAMERA.setWorldMatrix(mat)
        CLIP_CAMERA.rotateInWorld(dst, src)
        setTrans(mat4.copy(mat, CLIP_CAMERA.worldMatrix))

        if (canvas) {
            const list = new Engine.Scene(Array.from(scene || []).filter((item: Obj3WithEntity) => item.entity)),
                { ndc: { min, max } } = await Tool.Picker.bound(list, CLIP_CAMERA)
            console.log(min, max)

            const { buffer } = await Tool.Picker.clip(list, CLIP_CAMERA, { width: 500, height: 500 })
            await showBuffer(buffer, canvas)
        }
    }, [dir, pos])
    return <Mesh matrix={ trans } geo={ CLIP_GEO } mat={ CLIP_MAT } />
}
