#version 300 es

in vec4 a_position;

//${opts.vertexNormalAttr ? `
in vec3 ${opts.vertexNormalAttr};
out vec3 v_normal;
//` : ''}

//${opts.vertexColorAttr ? `
in vec4 ${opts.vertexColorAttr};
out vec4 v_color;
//` : ''}

uniform mat4 u_view_proj;
uniform mat4 u_model_matrix;

void main() {
    gl_Position = u_view_proj * u_model_matrix * a_position;

//${opts.vertexNormalAttr ? `
    v_normal = mat3(u_model_matrix) * ${opts.vertexNormalAttr};
//` : ''}

//${opts.vertexColorAttr ? `
    v_color = ${opts.vertexColorAttr};
//` : ''}
}
