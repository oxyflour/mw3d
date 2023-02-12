// @chunk:common
// @vert
#version 300 es
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

in vec3 position;
void main() {
    gl_Position = cameraViewProjection * meshModelMatrix * vec4(position, 1.0);
}
// @frag
#version 300 es
precision mediump float;
uniform vec4 materialColor;

out vec4 out_FragColor;
void main() {
    out_FragColor = vec4(materialColor.rgb, 1.);
}
