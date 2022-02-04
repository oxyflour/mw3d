struct MaterialUniforms {
  color : vec4<f32>;
};
@group(3)
@binding(0)
var<uniform> material : MaterialUniforms;
