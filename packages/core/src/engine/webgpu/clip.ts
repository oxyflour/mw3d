import Geometry, { PlaneXY } from "../geometry"
import Material, { BasicMaterial } from "../material"
import Mesh from "../mesh"

type RenderMesh = Mesh & { geo: Geometry, mat: Material }

const CLIP_GEO = new PlaneXY({ size: 200 })
const CLIP_MATS = {
    back: new BasicMaterial({
        color: [1, 1, 1, 0],
        wgsl: {
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
        color: [1, 1, 1, 0],
        wgsl: {
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
        wgsl: {
            // TODO: compute the right coords for a plane covering camera
            vert: `fn vertMainPlane(input: VertexInput) -> VertexOutput {
                var output: VertexOutput;
                var norm = normalize(material.clipPlane.xyz);
                var dx = normalize(vec3<f32>(-norm.y, norm.x + norm.z, -norm.y));
                var dy = cross(norm, dx);
                var delta = vec3<f32>();
                var idx = input.vertexID % 4u;
                if (idx == 0u) {
                    delta = - dx - dy;
                } else if (idx == 1u) {
                    delta = - dx + dy;
                } else if (idx == 2u) {
                    delta =   dx + dy;
                } else if (idx == 3u) {
                    delta =   dx - dy;
                }

                var size = 500.;
                var pos = vec4<f32>(delta * size, 1.0);
                if (norm.x != 0.) {
                    pos.x -= material.clipPlane.w / norm.x;
                } else if (norm.y != 0.) {
                    pos.y -= material.clipPlane.w / norm.y;
                } else if (norm.z != 0.) {
                    pos.z -= material.clipPlane.w / norm.z;
                }

                output.position = camera.viewProjection * mesh.modelMatrix * pos;
                output.normal = (mesh.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
                output.worldPosition = mesh.modelMatrix * pos;
                return output;
            }`,
            frag: `fn fragMainColorPlane(input: FragInput) -> @location(0) vec4<f32> {
                preventLayoutChange();
                var n = material.metallic;
                var v = material.roughness;
                var k = input.position.x + input.position.y * 0.4;
                var s = k - floor(k / n) * n;
                if (s > v) {
                    return vec4<f32>(material.color.rgb * 0.5, 1.);
                }
                return material.color;
            }`
        },
        primitive: {
            cullMode: 'none',
        },
        depthStencil: {
            stencilFront: {
                compare: 'equal',
                failOp: 'zero',
                passOp: 'zero',
                depthFailOp: 'zero',
            },
            stencilBack: {
                compare: 'equal',
                failOp: 'zero',
                passOp: 'zero',
                depthFailOp: 'zero',
            },
        },
    })
}

export class ClipMeshes {
    back = new Mesh(undefined, CLIP_MATS.back) as RenderMesh
    front = new Mesh(undefined, CLIP_MATS.front) as RenderMesh
    plane = new Mesh(CLIP_GEO) as RenderMesh
    private static planeMats = new WeakMap<Material, Material>()
    update(item: RenderMesh) {
        this.back.geo = item.geo
        this.back.setWorldMatrix(item.worldMatrix)
        this.back.mat.clip.copy(item.mat.clip)

        this.front.geo = item.geo
        this.front.setWorldMatrix(item.worldMatrix)
        this.front.mat.clip.copy(item.mat.clip)

        let mat = ClipMeshes.planeMats.get(item.mat)
        if (!mat) {
            ClipMeshes.planeMats.set(item.mat, mat = new BasicMaterial(CLIP_MATS.plane.opts))
        }

        this.plane.mat = mat
        mat.prop.copy(item.mat.prop)
        mat.clip.copy(item.mat.clip)

        // Note: DO NOT set stride for picker
        const stride = item.mat.opts.wgsl?.frag === 'fragMainColor' ? 0 : 5
        mat.prop.metallic = stride
        mat.prop.roughness = stride / 5 * 3
    }
}
