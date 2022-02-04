//${uniform.g0.camera.wgsl}
//${uniform.g1.mesh.wgsl}

struct VertexOutput {
  @builtin(position)
  Position : vec4<f32>;
};

@stage(vertex)
fn main(@location(0) position: vec4<f32>) -> VertexOutput {
  var output: VertexOutput;
  output.Position = camera.viewProjection * mesh.modelMatrix * position;
  return output;
}
