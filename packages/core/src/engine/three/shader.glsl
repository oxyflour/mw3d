// @chunk:depth
// @vert
varying vec4 vPos;
void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vPos = (gl_Position + 1.) * .5;
}
// @frag
#include <packing>
varying vec4 vPos;
uniform sampler2D tDepth;
void main() {
    float v = texture2D(tDepth, vPos.xy).x;
    v = 1. - v / 2.;
    uint i = uint(v * float(0x1000000));
    uint r = (i & 0x0000ffu);
    uint g = (i & 0x00ff00u) >> 8u;
    uint b = (i & 0xff0000u) >> 16u;
    gl_FragColor = vec4(
        float(r) / 255.,
        float(g) / 255.,
        float(b) / 255.,
        1.);
}

// @chunk:line
// @vert
uniform vec2 vResolution;
uniform float fLineWidth;
void main() {
    vec4 p0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 p1 = projectionMatrix * modelViewMatrix * vec4(normal, 1.0);
    vec4 dir = normalize(p0 - p1);
    int idx = gl_VertexID % 4;
    float thickness = fLineWidth / vResolution.x * p0.w;
    if (idx == 0 || idx == 3) {
        thickness *= -1.;
    }
    p0.y -= thickness * dir.x;
    p0.x += thickness * dir.y;
    gl_Position = p0;
}
// @frag
uniform vec3 vColor;
void main() {
    gl_FragColor = vec4(vColor, 1.);
}

// @chunk:dash
// @vert
void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
// @frag
void main() {
    gl_FragColor = vec4(1., 0., 0., 1.);
}
