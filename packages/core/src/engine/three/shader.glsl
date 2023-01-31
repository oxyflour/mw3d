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
uniform vec4 vColor;
void main() {
    gl_FragColor = vColor;
}

// @chunk:sprite
// @vert
uniform vec2 vResolution;
varying vec2 vUv;
void main() {
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec2 size = normal.xy;
    if (normal.z != 0.) {
        size = size / vResolution * pos.w;
    }
    int idx = gl_VertexID % 4;
    vec2 delta = vec2(0., 0.);
    if (idx == 0) {
        delta = vec2(-.5, -.5);
    } else if (idx == 1) {
        delta = vec2( .5, -.5);
    } else if (idx == 2) {
        delta = vec2(-.5,  .5);
    } else if (idx == 3) {
        delta = vec2( .5,  .5);
    }
    pos.x += size.x * delta.x;
    pos.y += size.y * delta.y;
    vUv.x = delta.x + 0.5;
    vUv.y = delta.y + 0.5;
    gl_Position = pos;
}
// @frag
varying vec2 vUv;
uniform sampler2D tMap;
uniform vec4 vColor;
void main() {
    vec4 c = texture2D(tMap, vUv);
    if (c.a == 0.) {
        discard;
    }
    gl_FragColor = c;
}

// @chunk:dash
// @vert
varying vec4 vPos;
void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vPos = gl_Position;
}
// @frag
uniform vec2 vDash;
uniform vec4 vColor;
uniform vec2 vResolution;
varying vec4 vPos;
void main() {
    float n = vDash.x;
    float v = vDash.y;
    vec2 s = fract(vPos.xy / vPos.w * vResolution / n) * n;
    if (v > 0.) {
        if (s.x > v || s.y > v) {
            discard;
        }
    } else if (v < 0.) {
        if (s.x < -v || s.y < -v) {
            discard;
        }
    }
    gl_FragColor = vColor;
}
