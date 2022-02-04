struct MaterialUniforms {
  color : vec4<f32>;
};
@group(2)
@binding(0)
var<uniform> material : MaterialUniforms;
