struct LightUniforms {
  direction : vec4<f32>;
};
@group(1)
@binding(0)
var<uniform> light : LightUniforms;
