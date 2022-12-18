@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) threadId : vec3<u32>) {
    let screenSize = textureDimensions(color_buffer);
    let screenPos = vec2<u32>(threadId.x, threadId.y);
}
