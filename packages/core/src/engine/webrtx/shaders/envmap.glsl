#version 460
#extension GL_EXT_ray_tracing : enable

#extension GL_GOOGLE_include_directive : require
#include "common.glsl"

layout(location = 0) rayPayloadInEXT RayPayload_PT_Radiance payload;

layout(set = 0, binding = 3) uniform sampler samp;
layout(set = 0, binding = 4) uniform texture2D texEnvmap;

void main() {
  if (payload.alpha != vec3(0.)) {
    vec2 uv = yup_spherical_uv(gl_WorldRayDirectionEXT);
    payload.emit_radiance = vec4(vec3(texture(sampler2D(texEnvmap, samp), uv)), 1.);
  }
  payload.done = true;
}
