import { Engine, Tool, useCanvas } from "@ttk/react"
import { vec3, mat4 } from 'gl-matrix'
import { useEffect, useState } from "react"

import { ViewOpts } from "../../../utils/data/view"
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

const CLIP_GEO = new Engine.PlaneXY(),
    CLIP_MAT = new Engine.BasicMaterial({
        texture: new Engine.Texture({
            size: { width: 500, height: 500 },
            format: 'rgba8snorm',
            usage: Engine.Texture.Usage.TEXTURE_BINDING
        }),
        wgsl: {
            vert: `
                fn vertMainClip(input: VertexInput) -> VertexOutput {
                    var output: VertexOutput;
                    output.position = camera.viewProjection * mesh.modelMatrix * input.position;
                    output.normal = input.position.xyz;
                    output.worldPosition = mesh.modelMatrix * input.position;
                    return output;
                }
            `,
            frag: `
                fn fragMainClip(input: FragInput) -> @location(0) vec4<f32> {
                    preventLayoutChange();
                    var C = textureSample(imageTexture, materialSampler, input.normal.xy);
                    return vec4(C.rgb, 1.);
                }
            `
        }
    }),
    CLIP_CAMERA = new Engine.PerspectiveCamera()
export default function Clip({ view }: {
    view: ViewOpts
}) {
    const { dir, pos } = view.clipPlane || { },
        { scene, canvas } = useCanvas(),
        [mesh, setMesh] = useState<Engine.Mesh>()
    useEffect(() => {
        const mesh = new Engine.Mesh(CLIP_GEO, CLIP_MAT, { scaling: [100, 100, 100] })
        scene?.add(mesh)
        setMesh(mesh)
        return () => {
            scene?.delete(mesh)
        }
    }, [scene])
    async function show() {
        if (canvas) {
            const list = new Engine.Scene(Array.from(scene || []).filter((item: Obj3WithEntity) => item.entity)),
                { ndc: { center, size } } = await Tool.Picker.bound(list, CLIP_CAMERA),
                { buffer } = await Tool.Picker.clip(list, CLIP_CAMERA, { width: 500, height: 500 }),
                { texture } = CLIP_MAT.opts
            if (texture) {
                texture.opts.source = await createImageBitmap(new Blob([buffer]))
            }
            //await showBuffer(buffer, canvas)
            center
            size
            buffer
            showBuffer
        }
    }
    useEffect(() => {
        const [x, y, z] = CLIP_DIRS[dir || '+x'] || [0, 0, 0],
            target = vec3.fromValues(0, 0, -1),
            xyz = vec3.fromValues(x, y, z),
            source = vec3.normalize(xyz, xyz),
            offset = vec3.scale(vec3.create(), source, - (pos || 0) / Math.hypot(x, y, z)),
            delta = vec3.scale(vec3.create(), source, (-500 - (pos || 0)) / Math.hypot(x, y, z)),
            mat = mat4.fromTranslation(mat4.create(), offset)
        mesh?.setWorldMatrix(mat)
        mesh?.rotateInWorld(source, target)
        mesh?.scaling.set(100, 100, 100)
        mesh?.updateIfNecessary({ })
        CLIP_CAMERA.setWorldMatrix(mat4.fromTranslation(mat4.create(), delta))
        CLIP_CAMERA.rotateInWorld(source, target)
        show()
    }, [dir, pos, mesh])
    return null
}
