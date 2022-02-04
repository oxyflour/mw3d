struct CameraUniforms {
  viewProjection : mat4x4<f32>;
};
@binding(0)
@group(0)
var<uniform> camera : CameraUniforms;

struct MeshUniforms {
  modelMatrix : mat4x4<f32>;
};
@binding(0)
@group(1)
var<uniform> mesh : MeshUniforms;

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
