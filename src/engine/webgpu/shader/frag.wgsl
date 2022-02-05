//${uniform.g1.light.wgsl}
//${uniform.g3.material.wgsl}

@stage(fragment)
fn main(
  @location(0) normal: vec3<f32>,
) -> @location(0) vec4<f32> {
    var n = normalize(normal);
    var f = dot(n, light.direction.xyz * -1.0 * light.direction.w);
  return vec4<f32>(material.color.xyz * f, 1.0);
}
