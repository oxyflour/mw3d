@group(0) @binding(0) var outputBuffer: texture_storage_2d<rgba8unorm, write>;
struct RendererUniforms {
    cameraProp: vec2<f32>,
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
    t: f32,      // distance
    w: vec3<f32> // weight (用于返回其他信息，如重心坐标)
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

fn ray_aabb_test(o: vec3<f32>, d: vec3<f32>, bmin: vec3<f32>, bmax: vec3<f32>, maxT: f32) -> bool {
    let t0 = (bmin - o) / d;
    let t1 = (bmax - o) / d;
    let tmin = max(max(min(t0.x, t1.x), min(t0.y, t1.y)), min(t0.z, t1.z));
    let tmax = min(min(max(t0.x, t1.x), max(t0.y, t1.y)), max(t0.z, t1.z));
    return tmax >= max(0., tmin) && tmin < maxT;
}

fn ray_trace(o: vec3<f32>, d: vec3<f32>) -> HitResult {
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.));
    if (arrayLength(&bvhNodes) == 0u) {
        return ret;
    }
    var stack: array<u32, 128>;
    var sp = 0u;
    stack[sp] = 0u;
    sp = 1u;
    while (sp > 0u) {
        sp --;
        let idx = stack[sp];
        let node = bvhNodes[idx];
        if (!ray_aabb_test(o, d, node.min.xyz, node.max.xyz, ret.t)) {
            continue;
        }
        if (node.data.w > 0u) {
            let start = node.data.z;
            let count = node.data.w;
            for (var i = 0u; i < count; i ++) {
                let j = triangleIndex[start + i];
                let tri = meshFaces[j];
                let a = meshVerts[tri.x];
                let b = meshVerts[tri.y];
                let c = meshVerts[tri.z];
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
    return ret;
}

fn ray_segment_min_distance(
    o: vec3<f32>,   // ray origin
    d: vec3<f32>,   // ray direction (不要求单位化)
    a: vec3<f32>,    // segment start
    b: vec3<f32>,    // segment end
) -> vec3<f32> {
    let v = d;
    let w = b - a;
    let r = o - a;

    let a0 = dot(v, v);
    let b0 = dot(v, w);
    let c0 = dot(w, w);
    let d0 = dot(v, r);
    let e0 = dot(w, r);

    let eps = 1e-8;
    let denom = a0 * c0 - b0 * b0;

    var t: f32;
    var u: f32;

    if (abs(denom) > eps) {
        // 一般情况（非平行）
        t = (b0 * e0 - c0 * d0) / denom;
        u = (a0 * e0 - b0 * d0) / denom;
    } else {
        // ray 与 segment 方向近似平行
        t = 0.0;
        u = clamp(e0 / c0, 0.0, 1.0);
    }

    // 约束
    if (t < 0.0) {
        t = 0.0;
        u = clamp(e0 / c0, 0.0, 1.0);
    } else {
        u = clamp(u, 0.0, 1.0);
    }

    let pr = o + t * d;
    let ps = a + u * w;

    return vec3(length(pr - ps), t, u);
}

fn ray_closest(o: vec3<f32>, d: vec3<f32>, maxD: f32) -> HitResult {
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.));
    if (arrayLength(&bvhNodes) == 0u) {
        return ret;
    }
    var stack: array<u32, 128>;
    var sp = 0u;
    stack[sp] = 0u;
    sp = 1u;
    while (sp > 0u) {
        sp --;
        let idx = stack[sp];
        let node = bvhNodes[idx];
        if (!ray_aabb_test(o, d, node.min.xyz - maxD, node.max.xyz + maxD, f32_max)) {
            continue;
        }
        if (node.data.w > 0u) {
            let start = node.data.z;
            let count = node.data.w;
            for (var i = 0u; i < count; i ++) {
                let j = triangleIndex[start + i];
                let tri = meshFaces[j];
                let a = meshVerts[tri.x];
                let b = meshVerts[tri.y];
                let c = meshVerts[tri.z];
                let hit = ray_triangle_test(o, d, a.xyz, b.xyz, c.xyz);
                if (hit.t < f32_max) {
                    ret.t = 0;
                    return ret;
                }
                var dis: vec3<f32>;
                dis = ray_segment_min_distance(o, d, a.xyz, b.xyz);
                if (dis.x < ret.t) {
                    ret.t = dis.x;
                }
                dis = ray_segment_min_distance(o, d, b.xyz, c.xyz);
                if (dis.x < ret.t) {
                    ret.t = dis.x;
                }
                dis = ray_segment_min_distance(o, d, c.xyz, a.xyz);
                if (dis.x < ret.t) {
                    ret.t = dis.x;
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
    return ret;
}

const maxD = 10.0;

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) threadId : vec3<u32>) {
    let screenPos = vec2(i32(threadId.x), i32(threadId.y));
    let screenSize = vec2<f32>(textureDimensions(outputBuffer));
    let screenNDC = vec2<f32>(screenPos) / screenSize * 2. - 1.;
    let cameraNDC = vec4(screenNDC * renderer.cameraProp, -1., 1.);
    let cameraNear = camera.worldMatrix * cameraNDC;
    let rayOrigin = camera.worldPosition.xyz;
    let rayDir = normalize(cameraNear.xyz - rayOrigin);
    /*
     * for testing
     *
    var ret: vec4<f32>;
    if (1 == 0) {
        let hit = ray_trace(rayOrigin, rayDir);
        ret = vec4<f32>(hit.w, 1.);
    } else {
        let closest = ray_closest(rayOrigin, rayDir, maxD);
        ret = vec4<f32>(closest.t / maxD, 0., 0., 1.);
    }
     */
    let hit = ray_trace(rayOrigin, rayDir);
    let ret = vec4<f32>(hit.w, 1.);
    textureStore(outputBuffer, screenPos, ret);
}
