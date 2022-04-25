struct CameraUniforms {
  viewProjection: mat4x4<f32>,
  worldPosition: vec4<f32>,
}
@group(0) @binding(0) var<uniform> camera: CameraUniforms;

struct LightUniforms {
  direction: vec4<f32>,
}
@group(1) @binding(0) var<uniform> light: LightUniforms;

struct MeshUniforms {
  modelMatrix: mat4x4<f32>,
}
@group(2) @binding(0) var<uniform> mesh: MeshUniforms;

struct MaterialUniforms {
  color: vec4<f32>,
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
};

@stage(vertex)
fn vertMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = camera.viewProjection * mesh.modelMatrix * input.position;
  output.normal = (mesh.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
  return output;
}

// frag

struct FragInput {
  @location(0) normal: vec3<f32>,
};

@stage(fragment)
fn fragMainNormal(input: FragInput) -> @location(0) vec4<f32> {
  var n = normalize(input.normal);
  var f = dot(n, light.direction.xyz * -1.0 * light.direction.w);
  return vec4<f32>(material.color.rgb * f, material.color.a);
}

@stage(fragment)
fn fragMain(input: FragInput) -> @location(0) vec4<f32> {
  // FIXME: we need this line or the layout will change
  var d = light.direction;
  return material.color;
}
