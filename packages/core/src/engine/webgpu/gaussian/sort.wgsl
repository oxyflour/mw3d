const WORKGROUP_SIZE = 256u;

struct Params {
  pointCount: u32,
  binCount: u32,
  _pad0: u32,
  _pad1: u32,
}

struct Uniforms {
  model: mat4x4<f32>,
  viewProjection: mat4x4<f32>,
  params: Params,
}

@group(0) @binding(0) var<storage, read> positions: array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> binCounts: array<atomic<u32>>;
@group(0) @binding(2) var<storage, read_write> binOffsets: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> indices: array<u32>;
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

fn computeBin(pos: vec3<f32>) -> u32 {
  let clip = uniforms.viewProjection * uniforms.model * vec4<f32>(pos, 1.0);
  if (clip.w <= 0.0) {
    return 0u;
  }
  var depth = clamp(clip.z / clip.w, 0.0, 1.0);
  depth = sqrt(depth);
  let maxBin = max(1u, uniforms.params.binCount) - 1u;
  return u32(depth * f32(maxBin));
}

@compute @workgroup_size(WORKGROUP_SIZE)
fn clearBins(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= uniforms.params.binCount) {
    return;
  }
  atomicStore(&binCounts[idx], 0u);
  atomicStore(&binOffsets[idx], 0u);
}

@compute @workgroup_size(WORKGROUP_SIZE)
fn countBins(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= uniforms.params.pointCount) {
    return;
  }
  let pos = positions[idx].xyz;
  let bin = computeBin(pos);
  atomicAdd(&binCounts[bin], 1u);
}

@compute @workgroup_size(1)
fn prefixBins(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x > 0u) {
    return;
  }
  var sum: u32 = 0u;
  for (var i: u32 = 0u; i < uniforms.params.binCount; i = i + 1u) {
    let count = atomicLoad(&binCounts[i]);
    atomicStore(&binOffsets[i], sum);
    sum = sum + count;
  }
}

@compute @workgroup_size(WORKGROUP_SIZE)
fn scatterIndices(@builtin(global_invocation_id) id: vec3<u32>) {
  let idx = id.x;
  if (idx >= uniforms.params.pointCount) {
    return;
  }
  let pos = positions[idx].xyz;
  let bin = computeBin(pos);
  let dst = atomicAdd(&binOffsets[bin], 1u);
  let vertexBase = idx * 4u;
  let indexBase = dst * 6u;
  indices[indexBase] = vertexBase;
  indices[indexBase + 1u] = vertexBase + 1u;
  indices[indexBase + 2u] = vertexBase + 2u;
  indices[indexBase + 3u] = vertexBase + 1u;
  indices[indexBase + 4u] = vertexBase + 3u;
  indices[indexBase + 5u] = vertexBase + 2u;
}
