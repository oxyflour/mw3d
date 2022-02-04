//${uniform.g2.material.wgsl}

@stage(fragment)
fn main() -> @location(0) vec4<f32> {
  var c = material.color;
  return material.color;// vec4<f32>(1., 0., 0., 1.);
}
