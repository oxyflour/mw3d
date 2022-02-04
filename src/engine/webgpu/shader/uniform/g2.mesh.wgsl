struct MeshUniforms {
  modelMatrix : mat4x4<f32>;
};
@group(2)
@binding(0)
var<uniform> mesh : MeshUniforms;
