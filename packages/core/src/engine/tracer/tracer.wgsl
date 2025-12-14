@group(0) @binding(0) var outputBuffer: texture_storage_2d<rgba16float, write>;
@group(0) @binding(1) var prevOutput: texture_2d<f32>;
struct RendererUniforms {
    cameraProp: vec2<f32>,
    sampleCount: f32,
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

@group(2) @binding(0) var<storage> meshVerts: array<vec4<f32>>;
@group(2) @binding(1) var<storage> meshFaces: array<vec4<u32>>;
@group(2) @binding(2) var<storage> bvhNodes: array<BVHNode>;
@group(2) @binding(3) var<storage> triangleIndex: array<u32>;

const f32_max = 1.17549e38;
const PI = 3.14159265359;
const EPSILON = 1e-4;

struct HitResult {
    t: f32,      // distance
    w: vec3<f32>, // barycentric weight
    face: u32,
}

struct Triangle {
    a: vec3<f32>,
    b: vec3<f32>,
    c: vec3<f32>,
}

// https://zhuanlan.zhihu.com/p/413989102
fn ray_triangle_test(o: vec3<f32>, d: vec3<f32>, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>) -> HitResult {
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.), 0xffffffffu);
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

fn load_triangle(faceIndex: u32) -> Triangle {
    let f = meshFaces[faceIndex];
    return Triangle(meshVerts[f.x].xyz, meshVerts[f.y].xyz, meshVerts[f.z].xyz);
}

fn ray_trace(o: vec3<f32>, d: vec3<f32>) -> HitResult {
    var ret = HitResult(f32_max, vec3<f32>(0., 0., 0.), 0xffffffffu);
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
                    hit.face = j;
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

fn hash_u32(x: u32) -> u32 {
    var v = x;
    v ^= v >> 17;
    v *= 0xed5ad4bbu;
    v ^= v >> 11;
    v *= 0xac4c1b51u;
    v ^= v >> 15;
    v *= 0x31848babu;
    v ^= v >> 14;
    return v;
}

fn rand(seed: ptr<function, u32>) -> f32 {
    (*seed) = hash_u32(*seed);
    return f32(*seed) / 4294967296.0;
}

fn cosine_sample_hemisphere(u1: f32, u2: f32) -> vec3<f32> {
    let r = sqrt(u1);
    let theta = 2.0 * PI * u2;
    let x = r * cos(theta);
    let y = r * sin(theta);
    let z = sqrt(max(0.0, 1.0 - u1));
    return vec3(x, y, z);
}

fn ggx_sample(u1: f32, u2: f32, roughness: f32) -> vec3<f32> {
    let a = roughness * roughness;
    let phi = 2.0 * PI * u1;
    let cosTheta = sqrt((1.0 - u2) / (1.0 + (a * a - 1.0) * u2));
    let sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
    return vec3(sinTheta * cos(phi), sinTheta * sin(phi), cosTheta);
}

fn tangent_basis(n: vec3<f32>) -> mat3x3<f32> {
    let cond = abs(n.y) < 0.99;
    let helper = select(
        vec3<f32>(1.0, 0.0, 0.0),
        vec3<f32>(0.0, 1.0, 0.0),
        vec3<bool>(cond, cond, cond)
    );
    let tangent = normalize(cross(helper, n));
    let bitangent = normalize(cross(n, tangent));
    return mat3x3<f32>(tangent, bitangent, n);
}

fn fresnel_schlick(cosTheta: f32, F0: vec3<f32>) -> vec3<f32> {
    return F0 + (vec3<f32>(1.0) - F0) * pow(1.0 - cosTheta, 5.0);
}

fn smith_ggx_G1(cosTheta: f32, alpha: f32) -> f32 {
    let a = alpha * alpha;
    let b = cosTheta * cosTheta;
    return 2.0 / (1.0 + sqrt(1.0 + a * (1.0 - b) / b));
}

fn environment(dir: vec3<f32>) -> vec3<f32> {
    let t = dir.y * 0.5 + 0.5;
    return mix(vec3<f32>(0.6, 0.7, 0.8), vec3<f32>(0.05, 0.08, 0.1), 1.0 - t);
}

fn pbr_trace(rayOrigin: vec3<f32>, rayDir: vec3<f32>, seed: ptr<function, u32>) -> vec3<f32> {
    var throughput = vec3<f32>(1.0, 1.0, 1.0);
    var radiance = vec3<f32>(0.0, 0.0, 0.0);
    var origin = rayOrigin;
    var dir = rayDir;
    let baseColor = vec3<f32>(0.8, 0.75, 0.7);
    let metallic = 0.05;
    let roughness = 0.35;

    for (var depth = 0; depth < 5; depth ++) {
        let hit = ray_trace(origin, dir);
        if (hit.face == 0xffffffffu) {
            radiance += throughput * environment(dir);
            break;
        }

        let tri = load_triangle(hit.face);
        let pos = hit.w.x * tri.a + hit.w.y * tri.b + hit.w.z * tri.c;
        let normal = normalize(cross(tri.b - tri.a, tri.c - tri.a));
        let n = faceForward(normal, -dir, normal);
        let basis = tangent_basis(n);

        let F0 = mix(vec3<f32>(0.04), baseColor, metallic);
        let wo = -dir;

        let r1 = rand(seed);
        let r2 = rand(seed);
        let r3 = rand(seed);

        let diffuseProb = 0.5;
        var wi_local: vec3<f32>;
        var pdf: f32;
        var specular = false;

        if (r1 < diffuseProb) {
            wi_local = cosine_sample_hemisphere(r2, r3);
            pdf = wi_local.z / PI * diffuseProb;
        } else {
            let h_local = ggx_sample(r2, r3, roughness);
            let h = normalize(basis * h_local);
            let wi = reflect(-wo, h);
            if (dot(wi, n) <= 0.0) {
                continue;
            }
            wi_local = (transpose(basis) * wi);
            pdf = 0.0;
            let cosThetaH = max(dot(h, n), 0.0);
            let cosThetaV = max(dot(wo, n), 0.0);
            let cosThetaL = max(dot(wi, n), 0.0);
            let D = (roughness * roughness) / (PI * pow((cosThetaH * cosThetaH * (roughness * roughness - 1.0) + 1.0), 2.0));
            let VoH = max(dot(wo, h), 0.0);
            pdf = (1.0 - diffuseProb) * D * cosThetaH / (4.0 * VoH + 1e-5);
            specular = true;
        }

        let wi = normalize(basis * wi_local);
        let cosTheta = max(dot(wi, n), 0.0);
        if (pdf < 1e-4 || cosTheta <= 0.0) {
            break;
        }

        if (specular) {
            let h = normalize(wi + wo);
            let cosThetaH = max(dot(n, h), 0.0);
            let cosThetaV = max(dot(n, wo), 0.0);
            let cosThetaL = cosTheta;
            let D = (roughness * roughness) / (PI * pow((cosThetaH * cosThetaH * (roughness * roughness - 1.0) + 1.0), 2.0));
            let G = smith_ggx_G1(cosThetaV, roughness) * smith_ggx_G1(cosThetaL, roughness);
            let F = fresnel_schlick(max(dot(h, wo), 0.0), F0);
            let spec = D * G * F / max(4.0 * cosThetaV * cosThetaL, 1e-5);
            throughput *= spec / pdf * cosTheta;
        } else {
            throughput *= baseColor * cosTheta / max(pdf * PI, 1e-5);
        }

        origin = pos + n * EPSILON;
        dir = wi;

        if (depth > 2) {
            let p = clamp(max(throughput.x, max(throughput.y, throughput.z)), 0.05, 0.95);
            if (rand(seed) > p) {
                break;
            }
            throughput /= p;
        }
    }

    return radiance;
}

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) threadId : vec3<u32>) {
    let screenPos = vec2(i32(threadId.x), i32(threadId.y));
    let screenSize = vec2<f32>(textureDimensions(outputBuffer));
    let screenNDC = vec2<f32>(screenPos) / screenSize * 2. - 1.;
    let cameraNDC = vec4(screenNDC * renderer.cameraProp, -1., 1.);
    let cameraNear = camera.worldMatrix * cameraNDC;
    let rayOrigin = camera.worldPosition.xyz;
    let rayDir = normalize(cameraNear.xyz - rayOrigin);

    var seed = hash_u32(u32(screenPos.x * 73856093 ^ screenPos.y * 19349663));
    let color = pbr_trace(rayOrigin, rayDir, &seed);

    let prevColor = textureLoad(prevOutput, screenPos).rgb;
    let count = renderer.sampleCount;
    let blended = (prevColor * count + color) / (count + 1.0);

    let ret = vec4<f32>(blended, 1.0);
    textureStore(outputBuffer, screenPos, ret);
}
