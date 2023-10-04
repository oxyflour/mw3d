@group(0) @binding(0) var color_buffer: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(1, 1, 1)
fn main(@builtin(global_invocation_id) threadId : vec3<u32>) {
    let screenSize = textureDimensions(color_buffer);
    let screenPos = vec2<u32>(threadId.x, threadId.y);
    if (screenPos.x / 5u % 2u == 0u && screenPos.y / 5u % 2u == 0u) {
        textureStore(color_buffer, vec2<i32>(screenPos), vec4(0., 1., 0., 1.));
    }
}
