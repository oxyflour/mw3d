//${uniform.g0.camera.wgsl}
//${uniform.g2.mesh.wgsl}

struct VertexOutput {
  @builtin(position)
  Position : vec4<f32>;
  @location(0)
  Normal: vec3<f32>;
};

@stage(vertex)
fn main(
  @location(0) position: vec4<f32>,
  @location(1) normal: vec3<f32>,
) -> VertexOutput {
  var output: VertexOutput;
  output.Position = camera.viewProjection * mesh.modelMatrix * position;
  output.Normal = (mesh.modelMatrix * vec4<f32>(normal, 0.0)).xyz;
  return output;
}
