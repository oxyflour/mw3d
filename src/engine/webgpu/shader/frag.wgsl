[[block]] struct Uniforms {
  ViewProjectionMatrix : mat4x4<f32>;
  ModelMatrix : mat4x4<f32>;
  LightDirection: vec4<f32>;
};
[[binding(0), group(0)]] var<uniform> uniforms : Uniforms;

[[stage(fragment)]]
fn main(
  [[location(0)]] normal: vec3<f32>) -> [[location(0)]] vec4<f32> {
  return vec3<f32>(1.0, 0.0, 0.0, 1.0);
}
