// @chunk:common
// @vert
#version 300 es

// https://github.com/mrdoob/three.js/blob/master/src/renderers/webgl/WebGLProgram.js
#define attribute in
#define varying out
#define texture2D texture
precision mediump sampler2DArray;

uniform vec2 renderCanvasSize;
uniform int renderLightNum;
uniform vec4 renderLight0;
uniform vec4 renderLight1;
uniform vec4 renderLight2;
uniform vec4 renderLight3;

uniform mat4 cameraViewProjection;
uniform vec4 cameraWorldPosition;

uniform mat4 meshModelMatrix;
uniform vec4 meshWorldPosition;

uniform vec4 materialColor;
uniform vec4 materialProp;
uniform vec4 materialClip;

attribute vec3 position;
void main() {
    gl_Position = cameraViewProjection * meshModelMatrix * vec4(position, 1.0);
}
// @frag
#version 300 es
#define gl_FragColor out_fragColor
#define gl_FragDepthEXT gl_FragDepth
#define texture2D texture
precision mediump float;

// https://github.com/mrdoob/three.js/blob/master/src/renderers/webgl/WebGLProgram.js
layout(location = 0) out highp vec4 out_fragColor;

uniform vec4 materialColor;

void main() {
    gl_FragColor = vec4(materialColor.rgb, 1.);
}
