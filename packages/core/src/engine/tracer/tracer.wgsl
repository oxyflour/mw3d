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

struct BVHNode {
    min: vec4<f32>,
    max: vec4<f32>,
    data: vec4<u32>,
}

@group(2) @binding(0) var<storage> meshVerts: array<vec4<f32>>;
@group(2) @binding(1) var<storage> meshFaces: array<vec4<u32>>;
@group(2) @binding(2) var<storage> bvhNodes: array<BVHNode>;
@group(2) @binding(3) var<storage> triangleIndex: array<u32>;

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

fn ray_aabb_test(o: vec3<f32>, invDir: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>, maxT: f32) -> bool {
    let t0 = (bmin - o) * invDir;
    let t1 = (bmax - o) * invDir;
    let tmin = max(max(min(t0.x, t1.x), min(t0.y, t1.y)), min(t0.z, t1.z));
    let tmax = min(min(max(t0.x, t1.x), max(t0.y, t1.y)), max(t0.z, t1.z));
    return tmax >= max(0., tmin) && tmin < maxT;
}

fn ray_trace(o: vec3<f32>, d: vec3<f32>) -> vec4<f32> {
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.));
    let nodeCount = arrayLength(&bvhNodes);
    if (nodeCount == 0u) {
        return vec4<f32>(ret.w, 1.);
    }
    var stack: array<u32, 128>;
    var sp = 0u;
    stack[sp] = 0u;
    sp = 1u;
    let invDir = 1. / d;
    loop {
        if (sp == 0u) { break; }
        sp --;
        let idx = stack[sp];
        let node = bvhNodes[idx];
        if (!ray_aabb_test(o, invDir, node.min.xyz, node.max.xyz, ret.t)) {
            continue;
        }
        if (node.data.w > 0u) {
            let start = node.data.z;
            let count = node.data.w;
            for (var i = 0u; i < count; i ++) {
                let triIdx = triangleIndex[start + i];
                let f = meshFaces[triIdx];
                let a = meshVerts[f.x];
                let b = meshVerts[f.y];
                let c = meshVerts[f.z];
                let hit = ray_triangle_test(o, d, a.xyz, b.xyz, c.xyz);
                if (hit.t < ret.t) {
                    ret = hit;
                }
            }
        } else {
            if (node.data.x != 0xffffffffu) {
                stack[sp] = node.data.x;
                sp ++;
            }
            if (node.data.y != 0xffffffffu) {
                stack[sp] = node.data.y;
                sp ++;
            }
        }
    }
    return vec4<f32>(ret.w, 1.);
}

fn ray_closest(o: vec3<f32>, d: vec3<f32>) -> vec3<f32> {
    var hitPoint = vec3<f32>(f32_max, f32_max, f32_max);
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.));
    let nodeCount = arrayLength(&bvhNodes);
    if (nodeCount == 0u) {
        return hitPoint;
    }
    var stack: array<u32, 128>;
    var sp = 0u;
    stack[sp] = 0u;
    sp = 1u;
    let invDir = 1. / d;
    loop {
        if (sp == 0u) { break; }
        sp --;
        let idx = stack[sp];
        let node = bvhNodes[idx];
        if (!ray_aabb_test(o, invDir, node.min.xyz, node.max.xyz, ret.t)) {
            continue;
        }
        if (node.data.w > 0u) {
            let start = node.data.z;
            let count = node.data.w;
            for (var i = 0u; i < count; i ++) {
                let triIdx = triangleIndex[start + i];
                let f = meshFaces[triIdx];
                let a = meshVerts[f.x];
                let b = meshVerts[f.y];
                let c = meshVerts[f.z];
                let hit = ray_triangle_test(o, d, a.xyz, b.xyz, c.xyz);
                if (hit.t < ret.t) {
                    ret = hit;
                    hitPoint = hit.w.x * a.xyz + hit.w.y * b.xyz + hit.w.z * c.xyz;
                }
            }
        } else {
            if (node.data.x != 0xffffffffu) {
                stack[sp] = node.data.x;
                sp ++;
            }
            if (node.data.y != 0xffffffffu) {
                stack[sp] = node.data.y;
                sp ++;
            }
        }
    }
    return hitPoint;
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
