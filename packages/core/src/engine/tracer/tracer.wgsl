@group(0) @binding(0) var outputBuffer: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var historyBuffer: texture_2d<f32>;
struct RendererUniforms {
    cameraProp: vec2<f32>,
    frameIndex: f32,
    padding: f32,
}
@group(0) @binding(2) var<uniform> renderer: RendererUniforms;

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

struct Material {
    color: vec4<f32>,
    roughness: f32,
    metallic: f32,
    lineWidth: f32,
    emissive: f32,
}

@group(2) @binding(0) var<storage> meshVerts: array<vec4<f32>>;
@group(2) @binding(1) var<storage> meshFaces: array<vec4<u32>>;
@group(2) @binding(2) var<storage> materials: array<Material>;
@group(2) @binding(3) var<storage> bvhNodes: array<BVHNode>;
@group(2) @binding(4) var<storage> triangleIndex: array<u32>;

const f32_max = 1.17549e38;
const u32_max = 0xffffffffu;
const PI = 3.14159265359;
const INV_PI = 0.31830988618;
const MAX_BOUNCES = 4u;

struct HitResult {
    t: f32,          // distance along ray
    w: vec3<f32>,    // barycentric weights
    f: u32,         // triangle index
}

fn max_component(v: vec3<f32>) -> f32 {
    return max(max(v.x, v.y), v.z);
}

fn rand(seed: ptr<function, u32>) -> f32 {
    var s = *seed;
    s ^= (s << 13u);
    s ^= (s >> 17u);
    s ^= (s << 5u);
    *seed = s;
    return f32(s & 0x00ffffffu) / f32(0x01000000u);
}

fn rand2(seed: ptr<function, u32>) -> vec2<f32> {
    return vec2<f32>(rand(seed), rand(seed));
}

// https://zhuanlan.zhihu.com/p/413989102
fn ray_triangle_test(o: vec3<f32>, d: vec3<f32>, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>) -> HitResult {
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.), u32_max);
    let e1 = b - a;
    let e2 = c - a;
    let p = cross(d, e2);
    var det = dot(e1, p);
    if (abs(det) < 1e-5) {
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
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.), u32_max);
    if (arrayLength(&bvhNodes) == 0u) {
        return ret;
    }
    var stack: array<u32, 128>;
    var sp = 0u;
    stack[sp] = 0u;
    sp = 1u;
    while (sp > 0u) {
        sp -= 1u;
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
                    ret.f = j;
                }
            }
        } else {
            if (node.data.x != u32_max) {
                stack[sp] = node.data.x;
                sp ++;
            }
            if (node.data.y != u32_max) {
                stack[sp] = node.data.y;
                sp ++;
            }
        }
    }
    return ret;
}

fn ray_segment_min_distance(
    o: vec3<f32>,   // ray origin
    d: vec3<f32>,   // ray direction (not normalized)
    a: vec3<f32>,   // segment start
    b: vec3<f32>,   // segment end
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
        t = (b0 * e0 - c0 * d0) / denom;
        u = (a0 * e0 - b0 * d0) / denom;
    } else {
        t = 0.0;
        u = clamp(e0 / c0, 0.0, 1.0);
    }

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
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.), u32_max);
    if (arrayLength(&bvhNodes) == 0u) {
        return ret;
    }
    var stack: array<u32, 128>;
    var sp = 0u;
    stack[sp] = 0u;
    sp = 1u;
    while (sp > 0u) {
        sp -= 1u;
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
                    ret.f = j;
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
            if (node.data.x != u32_max) {
                stack[sp] = node.data.x;
                sp ++;
            }
            if (node.data.y != u32_max) {
                stack[sp] = node.data.y;
                sp ++;
            }
        }
    }
    return ret;
}

fn make_basis(n: vec3<f32>) -> mat3x3<f32> {
    let up = select(vec3<f32>(0., 1., 0.), vec3<f32>(1., 0., 0.), abs(n.y) > 0.99);
    let t = normalize(cross(up, n));
    let b = cross(n, t);
    return mat3x3<f32>(t, b, n);
}

fn sample_cosine_hemisphere(n: vec3<f32>, xi: vec2<f32>) -> vec3<f32> {
    let r = sqrt(xi.x);
    let theta = 2.0 * PI * xi.y;
    let x = r * cos(theta);
    let y = r * sin(theta);
    let z = sqrt(max(0.0, 1.0 - xi.x));
    let basis = make_basis(n);
    return normalize(basis * vec3<f32>(x, y, z));
}

fn D_GGX(dotNH: f32, roughness: f32) -> f32 {
    let a = roughness * roughness;
    let a2 = a * a;
    let denom = dotNH * dotNH * (a2 - 1.0) + 1.0;
    return a2 / (PI * denom * denom);
}

fn G_Smith(dotNV: f32, dotNL: f32, roughness: f32) -> f32 {
    let r = roughness + 1.0;
    let k = (r * r) / 8.0;
    let g1 = dotNL / (dotNL * (1.0 - k) + k);
    let g2 = dotNV / (dotNV * (1.0 - k) + k);
    return g1 * g2;
}

fn fresnel_schlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
    return F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - cosTheta, 5.0);
}

fn sample_ggx(n: vec3<f32>, roughness: f32, xi: vec2<f32>) -> vec3<f32> {
    let a = max(0.05, roughness);
    let a2 = a * a;
    let phi = 2.0 * PI * xi.x;
    let cosTheta = sqrt((1.0 - xi.y) / (1.0 + (a2 - 1.0) * xi.y));
    let sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
    let hLocal = vec3<f32>(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
    let basis = make_basis(n);
    return normalize(basis * hLocal);
}

fn sky(dir: vec3<f32>) -> vec3<f32> {
    let t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    let horizon = vec3<f32>(0.6, 0.7, 0.8);
    let zenith = vec3<f32>(0.15, 0.2, 0.35);
    return mix(horizon, zenith, t);
}

fn trace_path(rayOrigin: vec3<f32>, rayDir: vec3<f32>, seedPtr: ptr<function, u32>) -> vec3<f32> {
    var origin = rayOrigin;
    var dir = rayDir;
    var throughput = vec3<f32>(1.0, 1.0, 1.0);
    var radiance = vec3<f32>(0.0, 0.0, 0.0);

    for (var bounce = 0u; bounce < MAX_BOUNCES; bounce ++) {
        let hit = ray_trace(origin, dir);
        if (hit.t >= f32_max - 1.0 || hit.f == u32_max) {
            radiance += throughput * sky(dir);
            break;
        }

        let tri = meshFaces[hit.f];
        let a = meshVerts[tri.x];
        let b = meshVerts[tri.y];
        let c = meshVerts[tri.z];
        let pos = hit.w.x * a.xyz + hit.w.y * b.xyz + hit.w.z * c.xyz;
        var n = normalize(cross(b.xyz - a.xyz, c.xyz - a.xyz));
        if (dot(n, dir) > 0.0) {
            n = -n;
        }

        let mat = materials[tri.w];
        let baseColor = mat.color.xyz;
        let roughness = clamp(mat.roughness, 0.05, 1.0);
        let metallic = clamp(mat.metallic, 0.0, 1.0);
        let emissive = mat.emissive;

        if (emissive > 0.0) {
            radiance += throughput * baseColor * emissive;
            break;
        }

        let V = -dir;
        let dotNV = max(dot(n, V), 0.0);
        if (dotNV <= 0.0) {
            break;
        }

        let diffuseProb = clamp(1.0 - metallic, 0.05, 0.95);
        let xi = rand(seedPtr);

        var newDir = dir;
        if (xi < diffuseProb) {
            newDir = sample_cosine_hemisphere(n, rand2(seedPtr));
            throughput *= baseColor;
        } else {
            let h = sample_ggx(n, roughness, rand2(seedPtr));
            newDir = reflect(-V, h);
            let dotNL = max(dot(n, newDir), 0.0);
            let dotNH = max(dot(n, h), 0.0);
            let dotVH = max(dot(V, h), 0.0);
            if (dotNL <= 0.0 || dotVH <= 0.0) {
                break;
            }
            let D = D_GGX(dotNH, roughness);
            let G = G_Smith(dotNV, dotNL, roughness);
            let F0 = mix(vec3<f32>(0.04), baseColor, metallic);
            let F = fresnel_schlick(dotVH, F0);
            let pdf = max(D * dotNH / (4.0 * dotVH), 1e-4);
            let specWeight = (D * G) / max(4.0 * dotNV, 1e-4);
            throughput *= F * specWeight / pdf;
        }

        if (bounce > 1u) {
            let p = clamp(max_component(throughput), 0.1, 0.95);
            if (rand(seedPtr) > p) {
                break;
            }
            throughput /= p;
        }

        origin = pos + n * 1e-3;
        dir = normalize(newDir);
    }
    return radiance;
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
    let screenPos = vec2<i32>(i32(threadId.x), i32(threadId.y));
    let screenSize = vec2<f32>(textureDimensions(outputBuffer));
    let screenNDC = vec2<f32>(screenPos) / screenSize * 2.0 - 1.0;
    let cameraNDC = vec4<f32>(screenNDC * renderer.cameraProp, -1.0, 1.0);
    let cameraNear = camera.worldMatrix * cameraNDC;

    let rayOrigin = camera.worldPosition.xyz;
    let rayDir = normalize(cameraNear.xyz - rayOrigin);

    var seed = (u32(threadId.x) * 1973u) ^ (u32(threadId.y) * 9277u) ^ 89173u ^ u32(renderer.frameIndex);
    let color = trace_path(rayOrigin, rayDir, &seed);
    let prev = textureLoad(historyBuffer, screenPos, 0).xyz;
    let frameIndex = max(renderer.frameIndex, 0.0);
    let accum = (prev * frameIndex + color) / (frameIndex + 1.0);
    textureStore(outputBuffer, screenPos, vec4<f32>(accum, 1.0));
}
