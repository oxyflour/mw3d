[[block]] struct Uniforms {
  ViewProjectionMatrix : mat4x4<f32>;
  ModelMatrix : mat4x4<f32>;
};
[[binding(0), group(0)]] var<uniform> uniforms : Uniforms;

struct VertexOutput {
  [[builtin(position)]] Position : vec4<f32>;
  [[location(0)]] Normal : vec3<f32>;
};

[[stage(vertex)]]
fn main(
  [[location(0)]] position : vec4<f32>,
  [[location(1)]] normal : vec3<f32>) -> VertexOutput {
  var out : VertexOutput;
  out.Position = uniforms.ViewProjectionMatrix * uniforms.ModelMatrix * position;
  out.Normal = normal;
  return out;
}
