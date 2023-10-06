@group(0) @binding(0) var outputBuffer: texture_storage_2d<rgba8unorm, write>;
struct RendererUniforms {
    cameraProp: vec2<f32>
}
@group(0) @binding(1) var<uniform> renderer: RendererUniforms;

struct CameraUniforms {
    viewProjection: mat4x4<f32>,
    worldPosition: vec4<f32>,
    worldMatrix: mat4x4<f32>,
}
@group(1) @binding(0) var<uniform> camera: CameraUniforms;

@group(2) @binding(0) var<storage> meshIndex: array<vec2<u32>>;
@group(2) @binding(1) var<storage> meshVerts: array<vec4<f32>>;
@group(2) @binding(2) var<storage> meshFaces: array<vec4<u32>>;
@group(2) @binding(3) var<storage> meshTrans: array<mat4x4<f32>>;

const f32_max = 1.17549e38;
struct HitResult {
    t: f32,
    w: vec3<f32>
}
// https://zhuanlan.zhihu.com/p/413989102
fn ray_triangle_test(o: vec3<f32>, d: vec3<f32>, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>) -> HitResult {
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.));
    let e1 = b - a;
    let e2 = c - a;
    let p = cross(d, e2);
    var det = dot(e1, p);
    if (abs(det) < 1e-4) {
        return ret;
    }

    var t = o - a;
    if (det < 0.) {
        t = -t;
        det = -det;
    }

    let u = dot(t, p);
    if (u < 0. || u > det) {
        return ret;
    }

    let q = cross(t, e1);
    let v = dot(d, q);
    if (v < 0. || v + u - det > 0.) {
        return ret;
    }

    let lt = dot(e2, q);
    if (lt < 0.) {
        return ret;
    }

    let invDet = 1. / det;
    ret.t = lt * invDet;
    ret.w.y = u * invDet;
    ret.w.z = v * invDet;
    ret.w.x = 1. - ret.w.y - ret.w.z;
    return ret;
}

fn ray_trace(o: vec3<f32>, d: vec3<f32>) -> vec4<f32> {
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.));
    let n = arrayLength(&meshIndex);
    for (var m = 0u; m < n; m ++) {
        let i0 = meshIndex[m].x;
        var i1: u32;
        if (m + 1u < n) {
            i1 = meshIndex[m + 1u].x;
        } else {
            i1 = arrayLength(&meshFaces);
        }
        let f0 = meshIndex[m].y;
        let t = meshTrans[m];
        for (var i = i0; i < i1; i ++) {
            let f = meshFaces[i];
            let a = t * meshVerts[f.x + f0];
            let b = t * meshVerts[f.y + f0];
            let c = t * meshVerts[f.z + f0];
            let hit = ray_triangle_test(o, d, a.xyz, b.xyz, c.xyz);
            if (hit.t < ret.t) {
                ret = hit;
            }
        }
    }
    return vec4<f32>(ret.w, 1.);
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) threadId : vec3<u32>) {
    let screenPos = vec2(i32(threadId.x), i32(threadId.y));
    let screenSize = vec2<f32>(textureDimensions(outputBuffer));
    let NDC = vec2<f32>(screenPos) / screenSize * 2. - 1.;
    let cameraNDC = vec4(NDC * renderer.cameraProp, -1., 1.);
    let cameraNear = camera.worldMatrix * cameraNDC;
    let rayOrigin = camera.worldPosition.xyz;
    let rayDir = normalize(cameraNear.xyz - rayOrigin);
    let hit = ray_trace(rayOrigin, rayDir);
    textureStore(outputBuffer, screenPos, hit);
}
