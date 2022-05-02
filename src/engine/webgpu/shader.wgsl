let MAX_LIGHTS = 4;
struct Light {
  worldPosition: vec4<f32>,
}
@group(0) @binding(0) var<uniform> lightNum: i32;
@group(0) @binding(1) var<uniform> lights: array<Light, 4>;
@group(0) @binding(2) var<uniform> canvasSize: vec2<f32>;
//@group(0) @binding(3) var depthSampler: sampler;

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
}
@group(3) @binding(0) var<uniform> material: MaterialUniforms;

// vert

struct VertexInput {
  @location(0) position: vec4<f32>,
  @location(1) normal: vec3<f32>,
}

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) worldPosition: vec4<f32>,
};

@stage(vertex)
fn vertMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = camera.viewProjection * mesh.modelMatrix * input.position;
  output.normal = (mesh.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
  output.worldPosition = mesh.modelMatrix * input.position;
  return output;
}

// frag

struct FragInput {
  @builtin(position) position: vec4<f32>,
  @location(0) normal: vec3<f32>,
  @location(1) worldPosition: vec4<f32>,
};

// https://github.com/samdauwe/webgpu-native-assets/blob/cac1816df6e3778c218bb0df29c1193a27ee0b40/shaders/pbr_basic/pbr.frag

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

@stage(fragment)
fn fragMain(input: FragInput) -> @location(0) vec4<f32> {
  var N = normalize(input.normal);
  var V = normalize(camera.worldPosition.xyz - input.worldPosition.xyz);
  var C = vec3<f32>(0.0, 0.0, 0.0);
  for (var i = 0; i < lightNum && i < MAX_LIGHTS; i = i + 1) {
    var L = normalize(lights[i].worldPosition.xyz - input.worldPosition.xyz);
    C = C + BRDF(L, V, N, material.metallic, material.roughness);
  }
  var n = canvasSize;
  //var g = textureSample(depthTexture, depthSampler, vec2<f32>(0.0));
  return vec4<f32>(C, material.color.a);
}

@stage(fragment)
fn fragMainColor(input: FragInput) -> @location(0) vec4<f32> {
  // FIXME: we need this line or the layout will change
  var tmp = lightNum;
  var tmp2 = lights;
  var n = canvasSize;
  //var g = textureSample(depthTexture, depthSampler, vec2<f32>(0.0));
  return material.color;
}

@stage(fragment)
fn fragMainCoord(input: FragInput) -> @location(0) vec4<f32> {
  var tmp = lightNum;
  var tmp2 = lights;
  var c = material.color;
  return vec4<f32>(
    input.position.x / canvasSize.x,
    input.position.y / canvasSize.y,
    0.0,
    1.0
  );
}
