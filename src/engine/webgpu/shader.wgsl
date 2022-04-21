@group(0) @binding(0) var<uniform> uCameraViewProjection: mat4x4<f32>;
@group(1) @binding(0) var<uniform> uLightDirection: vec4<f32>;
@group(2) @binding(0) var<uniform> uMeshModelMatrix: mat4x4<f32>;
@group(3) @binding(0) var<uniform> uMaterialColor: vec4<f32>;

// vert

struct VertexInput {
  @location(0)
  position: vec4<f32>;
  @location(1)
  normal: vec3<f32>;
}

struct VertexOutput {
  @builtin(position)
  position : vec4<f32>;
  @location(0)
  normal: vec3<f32>;
};

@stage(vertex)
fn vertMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uCameraViewProjection * uMeshModelMatrix * input.position;
  output.normal = (uMeshModelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
  return output;
}

// frag

struct FragInput {
  @location(0)
  normal: vec3<f32>;
};

@stage(fragment)
fn fragMain(input: FragInput) -> @location(0) vec4<f32> {
    var n = normalize(input.normal);
    var f = dot(n, uLightDirection.xyz * -1.0 * uLightDirection.w);
  return vec4<f32>(uMaterialColor.xyz * f, 1.0);
}
