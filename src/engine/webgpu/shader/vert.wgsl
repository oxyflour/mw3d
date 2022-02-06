//${uniform.g0.camera.wgsl}
//${uniform.g2.mesh.wgsl}

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
fn main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = camera.viewProjection * mesh.modelMatrix * input.position;
  output.normal = (mesh.modelMatrix * vec4<f32>(input.normal, 0.0)).xyz;
  return output;
}
