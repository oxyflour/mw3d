import { vec4 } from "gl-matrix"
import Geometry, { PlaneXY } from "../geometry"
import Material, { BasicMaterial } from "../material"
import Mesh from "../mesh"

type RenderMesh = Mesh & { geo: Geometry, mat: Material }

const CLIP_GEO = new PlaneXY({ size: 200 })
const CLIP_MATS = {
    back: new BasicMaterial({
        entry: {
            frag: `fn fragMainColorBack(input: FragInput) -> @location(0) vec4<f32> {
                checkClip(input);
                return material.color;
            }`
        },
        primitive: {
            cullMode: 'front',
        },
        depthStencil: {
            depthWriteEnabled: false,
            stencilBack: {
                compare: 'always',
                failOp: 'increment-clamp',
                passOp: 'increment-clamp',
                depthFailOp: 'increment-clamp',
            },
        },
    }),
    front: new BasicMaterial({
        entry: {
            frag: `fn fragMainColorFront(input: FragInput) -> @location(0) vec4<f32> {
                checkClip(input);
                return material.color;
            }`
        },
        primitive: {
            cullMode: 'back',
        },
        depthStencil: {
            depthWriteEnabled: false,
            stencilFront: {
                compare: 'always',
                failOp: 'decrement-clamp',
                passOp: 'decrement-clamp',
                depthFailOp: 'decrement-clamp',
            },
        },
    }),
    plane: new BasicMaterial({
        entry: {
            // TODO: compute the right coords for a plane covering camera
            vert: `fn vertMainPlane(input: VertexInput) -> VertexOutput {
                var output: VertexOutput;
                output.position = camera.viewProjection * mesh.modelMatrix * input.position;
                output.normal = (mesh.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
                output.worldPosition = mesh.modelMatrix * input.position;
                //var idx = input.vertexID % 4u;
                var idx = 99u;
                if (idx == 0u) {
                    output.position.x = 0.;
                    output.position.y = 0.;
                } else if (idx == 1u) {
                    output.position.x = 1.;
                    output.position.y = 0.;
                } else if (idx == 2u) {
                    output.position.x = 0.;
                    output.position.y = 1.;
                } else if (idx == 3u) {
                    output.position.x = 1.;
                    output.position.y = 1.;
                }
                return output;
            }`,
            frag: `fn fragMainColorPlane(input: FragInput) -> @location(0) vec4<f32> {
                preventLayoutChange();
                var n = 5.;
                var v = 3.;
                var k = input.position.x + input.position.y * 0.4;
                var s = k - floor(k / n) * n;
                if (s > v) {
                    return vec4<f32>(material.color.rgb * 0.5, 1.);
                }
                return material.color;
            }`
        },
        depthStencil: {
            stencilBack: {
                compare: 'equal',
                failOp: 'zero',
                passOp: 'decrement-clamp',
                depthFailOp: 'zero',
            },
        },
    })
}

export class ClipMeshes {
    back = new Mesh(undefined, CLIP_MATS.back) as RenderMesh
    front = new Mesh(undefined, CLIP_MATS.front) as RenderMesh
    plane = new Mesh(CLIP_GEO, new BasicMaterial({ ...CLIP_MATS.plane.opts })) as RenderMesh
    constructor({ color: { r, g, b } }: { color: { r: number, g: number, b: number } }) {
        Object.assign(this.plane.mat.prop, { r, g, b })
    }
    update(item: RenderMesh) {
        this.back.geo = item.geo
        this.back.setWorldMatrix(item.worldMatrix)
        vec4.copy(this.back.mat.clipPlane, item.mat.clipPlane)

        this.front.geo = item.geo
        this.front.setWorldMatrix(item.worldMatrix)
        vec4.copy(this.front.mat.clipPlane, item.mat.clipPlane)

        vec4.copy(this.plane.mat.clipPlane, item.mat.clipPlane)
    }
}
