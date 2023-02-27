import { Engine, Tool, useCanvas } from "@ttk/react"
import { vec3, mat4 } from 'gl-matrix'
import { useEffect, useState } from "react"

import { ViewOpts } from "../../../utils/data/view"
import { Obj3WithEntity } from "../pick/utils"

export const CLIP_DIRS = {
    '+x': [ 1, 0, 0],
    '-x': [-1, 0, 0],
    '+y': [0,  1, 0],
    '-y': [0, -1, 0],
    '+z': [0, 0,  1],
    '-z': [0, 0, -1],
} as Record<string, [number, number, number]>

const CLIP_DIST = 100,
    CLIP_GEO = new Engine.PlaneXY(),
    CLIP_CAMERA = new Engine.PerspectiveCamera({ fov: Math.PI / 2 })
function makeMaterial(source: ImageBitmap) {
    const { Usage } = Engine.Texture
    return new Engine.BasicMaterial({
        texture: new Engine.Texture({
            size: { width: 2048, height: 2048 },
            format: 'rgba8unorm',
            usage: Usage.TEXTURE_BINDING | Usage.COPY_DST | Usage.RENDER_ATTACHMENT,
            source
        }),
        wgsl: {
            vert: `
                fn vertMainClip(input: VertexInput) -> VertexOutput {
                    var output: VertexOutput;
                    output.position = camera.viewProjection * mesh.modelMatrix * input.position;
                    output.normal = input.position.xyz * .5 + .5;
                    output.worldPosition = mesh.modelMatrix * input.position;
                    return output;
                }
            `,
            frag: `
                fn fragMainClip(input: FragInput) -> @location(0) vec4<f32> {
                    preventLayoutChange();
                    var C = textureSample(imageTexture, materialSampler, input.normal.xy);
                    if (C.a == 0.) {
                        discard;
                    }
                    return vec4(input.normal.xy, 0., 1.);
                }
            `
        }
    })
}

export default function Clip({ view }: {
    view: ViewOpts
}) {
    const { dir, pos } = view.clipPlane || { },
        { scene, canvas } = useCanvas(),
        [mesh, setMesh] = useState<Engine.Mesh>()
    useEffect(() => {
        const mesh = new Engine.Mesh(CLIP_GEO)
        scene?.add(mesh)
        setMesh(mesh)
        return () => {
            scene?.delete(mesh)
        }
    }, [scene])
    async function show() {
        if (canvas) {
            const list = new Engine.Scene(Array.from(scene || []).filter((item: Obj3WithEntity) => item.entity)),
                { buffer } = await Tool.Picker.clip(list, CLIP_CAMERA, { width: 2048, height: 2048 }),
                img = document.createElement('img')
            img.src = URL.createObjectURL(new Blob([buffer]))
            await img.decode()
            mesh && (mesh.mat = makeMaterial(await createImageBitmap(img)))
        }
    }
    useEffect(() => {
        const [x, y, z] = CLIP_DIRS[dir || '+x'] || [0, 0, 0],
            p = pos || 0,
            target = vec3.fromValues(0, 0, -1),
            xyz = vec3.fromValues(x, y, z),
            source = vec3.normalize(xyz, xyz),
            offset = vec3.scale(vec3.create(), source, -p / Math.hypot(x, y, z)),
            delta = vec3.scale(vec3.create(), source, (-CLIP_DIST - p) / Math.hypot(x, y, z))
        mesh?.setWorldMatrix(mat4.fromTranslation(mat4.create(), offset))
        mesh?.rotateInWorld(source, target)
        mesh?.scaling.set(CLIP_DIST, CLIP_DIST, CLIP_DIST)
        mesh?.updateIfNecessary({ })
        CLIP_CAMERA.setWorldMatrix(mat4.fromTranslation(mat4.create(), delta))
        CLIP_CAMERA.rotateInWorld(source, target)
        show()
    }, [dir, pos, mesh])
    return null
}
