// @replace-let-with-const
let MAX_LIGHTS = 4;
struct Light {
  worldPosition: vec4<f32>,
}
@group(0) @binding(0) var<uniform> canvasSize: vec2<f32>;
@group(0) @binding(1) var<uniform> lightNum: i32;
@group(0) @binding(2) var<uniform> lights: array<Light, 4>;

struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  worldPosition: vec4<f32>,
}
@group(1) @binding(0) var<uniform> camera: CameraUniforms;

struct MeshUniforms {
  modelMatrix: mat4x4<f32>,
  worldPosition: vec4<f32>,
}
@group(2) @binding(0) var<uniform> mesh: MeshUniforms;

struct MaterialUniforms {
  color: vec4<f32>,
  roughness: f32,
  metallic: f32,
  lineWidth: f32,
  emissive: f32,
  clipPlane: vec4<f32>,
}
@group(3) @binding(0) var<uniform> material: MaterialUniforms;
@group(3) @binding(1) var depthTexture: texture_depth_2d;
@group(3) @binding(1) var depthMultiTexture: texture_depth_multisampled_2d;
@group(3) @binding(1) var imageTexture: texture_2d<f32>;
@group(3) @binding(2) var materialSampler: sampler;

// vert

struct VertexInput {
  @builtin(vertex_index) vertexID : u32,
  @location(0) position: vec4<f32>,
  @location(1) normal: vec3<f32>,
}

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) worldPosition: vec4<f32>,
};

@vertex
fn vertMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = camera.viewProjection * mesh.modelMatrix * input.position;
  output.normal = (mesh.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
  output.worldPosition = mesh.modelMatrix * input.position;
  return output;
}

@vertex
fn vertSpriteMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = camera.viewProjection * mesh.modelMatrix * input.position;
  output.worldPosition = mesh.modelMatrix * input.position;
  var size = vec2<f32>(input.normal.x, input.normal.y);
  if (input.normal.z != 0.) {
    size = size / canvasSize * output.position.w;
  }
  var idx = input.vertexID % 4u;
  var delta = vec2<f32>(0., 0.);
  if (idx == 0u) {
    delta = vec2<f32>(-0.5, -0.5);
  } else if (idx == 1u) {
    delta = vec2<f32>( 0.5, -0.5);
  } else if (idx == 2u) {
    delta = vec2<f32>(-0.5,  0.5);
  } else if (idx == 3u) {
    delta = vec2<f32>( 0.5,  0.5);
  }
  output.position.x += size.x * delta.x;
  output.position.y += size.y * delta.y;
  output.normal.x = delta.x + 0.5;
  output.normal.y = 0.5 - delta.y;
  return output;
}

@vertex
fn vertLineMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = camera.viewProjection * mesh.modelMatrix * input.position;
  output.worldPosition = mesh.modelMatrix * input.position;

  var p0 = output.position;
  var p1 = camera.viewProjection * mesh.modelMatrix * vec4<f32>(input.normal, 1.);
  var dir = normalize(p0 - p1);
  var idx = input.vertexID % 4u;
  var thickness = material.lineWidth / canvasSize.x * p0.w;
  if (idx == 0u || idx == 3u) {
    thickness *= -1.;
  }
  output.position.y -= thickness * dir.x;
  output.position.x += thickness * dir.y;
  return output;
}

// @vert-extra-code

// frag

struct FragInput {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) worldPosition: vec4<f32>,
};

// https://github.com/samdauwe/webgpu-native-assets/blob/cac1816df6e3778c218bb0df29c1193a27ee0b40/shaders/pbr_basic/pbr.frag

// @replace-let-with-const
let PI = 3.14159;
fn D_GGX(dotNH: f32, roughness: f32) -> f32 {
  var alpha = roughness * roughness;
  var alpha2 = alpha * alpha;
  var denom = dotNH * dotNH * (alpha2 - 1.0) + 1.0;
  return alpha2 / (PI * denom * denom);
}

fn G_SchlicksmithGGX(dotNL: f32, dotNV: f32, roughness: f32) -> f32 {
  var r = roughness + 1.0;
  var k = (r * r) / 8.0;
  var GL = dotNL / (dotNL * (1.0 - k) + k);
  var GV = dotNV / (dotNV * (1.0 - k) + k);
  return GL * GV;
}

fn F_Schlick(cosTheta: f32, metallic: f32) -> vec3<f32> {
  var F0 = mix(vec3<f32>(0.04), material.color.rgb, metallic);
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

fn BRDF(L: vec3<f32>, V: vec3<f32>, N: vec3<f32>, metallic: f32, roughness: f32) -> vec3<f32> {
  var H = normalize(V + L);
  var C = material.color.rgb;
  var dotNV = clamp(dot(N, V), 0.0, 1.0);
  var dotNL = clamp(dot(N, L), 0.0, 1.0);
  var dotNH = clamp(dot(N, H), 0.0, 1.0);

  var color = C * 0.2;
  if (dotNL > 0.0) {
    var D = D_GGX(dotNH, roughness);
    var G = G_SchlicksmithGGX(dotNL, dotNV, roughness);
    var F = F_Schlick(dotNV, metallic);
    var spec = D * F * G / (4.0 * dotNL * dotNV);
    color = color + (spec + C * 0.5) * dotNL;
  }
  return color;
}

fn pbrRender(input: FragInput) -> vec3<f32> {
  var N = normalize(input.normal);
  var V = normalize(camera.worldPosition.xyz - input.worldPosition.xyz);
  var C = vec3<f32>(0.0, 0.0, 0.0);
  for (var i = 0; i < lightNum && i < MAX_LIGHTS; i = i + 1) {
    var L = normalize(lights[i].worldPosition.xyz - input.worldPosition.xyz);
    C = C + BRDF(L, V, N, material.metallic, material.roughness);
  }
  return C;
}

fn preventLayoutChange() {
  if (false) {
    var a = lightNum;
    var b = lights;
    var c = canvasSize;
    var d = material;
  }
}

fn checkClip(input: FragInput) {
  preventLayoutChange();
  if (any(material.clipPlane != vec4<f32>())) {
    var c = material.clipPlane;
    var p = input.worldPosition;
    if (p.x * c.x + p.y * c.y + p.z * c.z + c.w < 0.) {
      discard;
    }
  }
}

@fragment
fn fragMain(input: FragInput) -> @location(0) vec4<f32> {
  var C = pbrRender(input) + material.emissive * material.color.rgb;
  checkClip(input);
  return vec4<f32>(C, material.color.a);
}

@fragment
fn fragMainColor(input: FragInput) -> @location(0) vec4<f32> {
  checkClip(input);
  return material.color;
}

@fragment
fn fragMainColorDash(input: FragInput) -> @location(0) vec4<f32> {
    checkClip(input);
    var n = material.metallic;
    var v = material.roughness;
    var s = fract(input.position.xy / n) * n;
    if (v > 0.) {
        if (s.x > v || s.y > v) {
            discard;
        }
    } else if (v < 0.) {
        if (s.x < -v || s.y < -v) {
            discard;
        }
    }
    return material.color;
}

@fragment
fn fragMainSprite(input: FragInput) -> @location(0) vec4<f32> {
  var C = textureSample(imageTexture, materialSampler, input.normal.xy);
  checkClip(input);
  if (C.a == 0.) {
    discard;
  }
  return vec4<f32>(C.xyz, material.color.a);
}

@fragment
fn fragMainDepth(input: FragInput) -> @location(0) vec4<f32> {
  preventLayoutChange();
  var p = input.position.xy / canvasSize.xy;
  var d = textureSample(depthTexture, materialSampler, p);
  // https://github.com/gpuweb/gpuweb/discussions/2277
  var i = u32(f32(0x1000000) * (d + 1.0) / 2.0);
  var r = (i & 0x0000ffu);
  var g = (i & 0x00ff00u) >> 8u;
  var b = (i & 0xff0000u) >> 16u;
  return vec4<f32>(f32(r) / 255.0, f32(g) / 255.0, f32(b) / 255.0, 1.0);
}

fn textureMultiSample(t: texture_depth_multisampled_2d, s: sampler, p: vec2<f32>) -> f32 {
  var z = textureDimensions(t);
  return textureLoad(depthMultiTexture, vec2<i32>(p * vec2<f32>(z)), 1);
}

@fragment
fn fragMainMultiDepth(input: FragInput) -> @location(0) vec4<f32> {
  preventLayoutChange();
  var p = input.position.xy / canvasSize.xy;
  var d = textureMultiSample(depthMultiTexture, materialSampler, p);
  return vec4<f32>(d, d, d, 1.0);
}

// @frag-extra-code
