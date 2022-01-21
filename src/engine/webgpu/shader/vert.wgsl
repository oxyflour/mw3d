[[stage(vertex)]]

fn main([[location(0)]] a_position : vec2<f32>) -> [[builtin(position)]] vec4<f32> {
  return vec4<f32>(a_position, 0.0, 1.0);
}
