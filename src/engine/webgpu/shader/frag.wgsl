//${uniform.g2.material.wgsl}

@stage(fragment)
fn main() -> @location(0) vec4<f32> {
  return material.color;
}
