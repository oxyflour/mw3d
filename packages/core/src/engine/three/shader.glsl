// @chunk:common
// @vert
uniform vec4 materialProp;
#define materialRoughness materialProp.x
#define materialMetallic  materialProp.y
#define materialLineWidth materialProp.z
#define materialEmissive  materialProp.w
// @frag
uniform vec4 materialProp;
#define materialRoughness materialProp.x
#define materialMetallic  materialProp.y
#define materialLineWidth materialProp.z
#define materialEmissive  materialProp.w
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
uniform sampler2D materialMapDepth;
void main() {
    float v = texture2D(materialMapDepth, vPos.xy).x;
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
// @chunk:depthGL2
// @vert
varying vec4 vPos;
void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vPos = (gl_Position + 1.) * .5;
}
// @frag
#include <packing>
varying vec4 vPos;
uniform sampler2D materialMapDepth;
void main() {
    float v = texture2D(materialMapDepth, vPos.xy).x;
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
uniform vec2 renderCanvasSize;
void main() {
    vec4 p0 = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec4 p1 = projectionMatrix * modelViewMatrix * vec4(normal, 1.0);
    vec2 dir = normalize(p0.xy - p1.xy);
    dir = vec2(dir.y, -dir.x);
    int idx = gl_VertexID % 4;
    float thickness = materialLineWidth / renderCanvasSize.x * p0.w;
    if (idx == 0 || idx == 3) {
        thickness *= -1.;
    }
    p0.xy += thickness * dir;
    gl_Position = p0;
    vWorldPosition = (meshModelMatrix * vec4(position, 1.0)).xyz;
}
// @frag
uniform vec4 materialColor;
void main() {
    checkClip();
    gl_FragColor = materialColor;
}

// @chunk:sprite
// @vert
uniform vec2 renderCanvasSize;
varying vec2 vUv;
void main() {
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vec2 size = normal.xy;
    if (normal.z != 0.) {
        size = size / renderCanvasSize * pos.w;
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
    pos.xy += size * delta;
    vUv.x = delta.x + 0.5;
    vUv.y = 0.5 - delta.y;
    gl_Position = pos;
}
// @frag
varying vec2 vUv;
uniform sampler2D materialMap;
uniform vec4 materialColor;
void main() {
    checkClip();
    vec4 c = texture2D(materialMap, vUv);
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
uniform vec4 materialColor;
uniform vec2 renderCanvasSize;
varying vec4 vPos;
void main() {
    checkClip();
    float n = materialMetallic;
    float v = materialRoughness;
    vec2 s = fract(vPos.xy / vPos.w * renderCanvasSize / n) * n;
    if (v > 0.) {
        if (s.x > v || s.y > v) {
            discard;
        }
    } else if (v < 0.) {
        if (s.x < -v || s.y < -v) {
            discard;
        }
    }
    gl_FragColor = materialColor;
}

// @chunk:clipPlane
// @vert
uniform vec4 materialClip;
void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
// @frag
void main() {
    checkClip();
    float n = materialMetallic;
    gl_FragColor = materialColor;
}
