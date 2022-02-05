#version 300 es
precision mediump float;

uniform vec4 u_light_direction;

//${opts.color ? `
uniform vec4 u_color;
//` : ''}

//${opts.vertexColorAttr ? `
in vec4 v_color;
//` : ''}

//${opts.vertexNormalAttr ? `
in vec3 v_normal;
//` : ''}

out vec4 outColor;

void main() {
//${opts.color ? `
    outColor = u_color;
//` : opts.vertexColorAttr ? `
    outColor = v_color;
//` : `
    outColor = vec4(1., 0., 0., 1.);
//`}

//${opts.vertexNormalAttr ? `
    vec3 normal = normalize(v_normal);
    float light = dot(normal, u_light_direction.xyz * -1. * u_light_direction.w);
    outColor.rgb *= light;
//` : ''}
}
