// @chunk:base
// @vert
#version 300 es

// https://github.com/mrdoob/three.js/blob/master/src/renderers/webgl/WebGLProgram.js
#define attribute in
#define varying out
#define texture2D texture
precision mediump float;
precision mediump sampler2DArray;

uniform vec2 renderCanvasSize;
uniform int renderLightNum;
uniform vec4 renderLightPosition0;
uniform vec4 renderLightPosition1;
uniform vec4 renderLightPosition2;
uniform vec4 renderLightPosition3;

uniform mat4 cameraViewProjection;
uniform vec4 cameraWorldPosition;

uniform mat4 meshModelMatrix;
uniform vec4 meshWorldPosition;

uniform vec4 materialColor;
uniform vec4 materialProp;
uniform vec4 materialClip;
#define materialRoughness materialProp.x
#define materialMetallic  materialProp.y
#define materialLineWidth materialProp.z
#define materialEmissive  materialProp.w

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

attribute vec3 position;
attribute vec3 normal;

void main() {
    gl_Position = cameraViewProjection * meshModelMatrix * vec4(position, 1.0);
    vWorldPosition = (meshModelMatrix * vec4(position, 1.0)).xyz;
    vWorldNormal = (meshModelMatrix * vec4(normal, 0.0)).xyz;
}
// @frag
#version 300 es
#define varying in
#define gl_FragColor out_fragColor
#define gl_FragDepthEXT gl_FragDepth
#define texture2D texture
precision mediump float;

// https://github.com/mrdoob/three.js/blob/master/src/renderers/webgl/WebGLProgram.js
layout(location = 0) out highp vec4 out_fragColor;

uniform vec2 renderCanvasSize;
uniform int renderLightNum;
uniform vec4 renderLightPosition0;
uniform vec4 renderLightPosition1;
uniform vec4 renderLightPosition2;
uniform vec4 renderLightPosition3;

uniform vec4 cameraWorldPosition;

uniform vec4 materialColor;
uniform vec4 materialProp;
#define materialRoughness materialProp.x
#define materialMetallic  materialProp.y
#define materialLineWidth materialProp.z
#define materialEmissive  materialProp.w

varying vec3 vWorldPosition;
varying vec3 vWorldNormal;

const float PI = 3.14159;
float D_GGX(float dotNH, float roughness) {
  float alpha = roughness * roughness;
  float alpha2 = alpha * alpha;
  float denom = dotNH * dotNH * (alpha2 - 1.0) + 1.0;
  return alpha2 / (PI * denom * denom);
}

float G_SchlicksmithGGX(float dotNL, float dotNV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  float GL = dotNL / (dotNL * (1.0 - k) + k);
  float GV = dotNV / (dotNV * (1.0 - k) + k);
  return GL * GV;
}

vec3 F_Schlick(float dotNV, float metallic) {
  vec3 F0 = mix(vec3(0.04), materialColor.rgb, metallic);
  return F0 + (1.0 - F0) * pow(1.0 - dotNV, 5.0);
}

vec3 BRDF(vec3 L, vec3 V, vec3 N, float metallic, float roughness) {
  vec3 H = normalize(V + L);
  vec3 C = materialColor.rgb;
  float dotNV = clamp(dot(N, V), 0.0, 1.0);
  float dotNL = clamp(dot(N, L), 0.0, 1.0);
  float dotNH = clamp(dot(N, H), 0.0, 1.0);

  vec3 color = C * 0.2;
  if (dotNL > 0.0) {
    float D = D_GGX(dotNH, roughness);
    float G = G_SchlicksmithGGX(dotNL, dotNV, roughness);
    vec3 F = F_Schlick(dotNV, metallic);
    vec3 spec = D * F * G / (4.0 * dotNL * dotNV);
    color = color + (spec + C * 0.5) * dotNL;
  }
  return color;
}

vec3 pbrRender() {
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(cameraWorldPosition.xyz - vWorldPosition.xyz);
  vec3 C = vec3(0.0, 0.0, 0.0);
  if (renderLightNum > 0) {
    vec3 L = normalize(renderLightPosition0.xyz - vWorldPosition.xyz);
    C = C + BRDF(L, V, N, materialMetallic, materialRoughness);
  }
  if (renderLightNum > 1) {
    vec3 L = normalize(renderLightPosition1.xyz - vWorldPosition.xyz);
    C = C + BRDF(L, V, N, materialMetallic, materialRoughness);
  }
  if (renderLightNum > 2) {
    vec3 L = normalize(renderLightPosition2.xyz - vWorldPosition.xyz);
    C = C + BRDF(L, V, N, materialMetallic, materialRoughness);
  }
  if (renderLightNum > 3) {
    vec3 L = normalize(renderLightPosition3.xyz - vWorldPosition.xyz);
    C = C + BRDF(L, V, N, materialMetallic, materialRoughness);
  }
  return C;
}

void main() {
    gl_FragColor = vec4(pbrRender(), materialColor.a);
}
