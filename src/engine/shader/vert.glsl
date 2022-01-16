#version 300 es

in vec4 a_position;

//${opts.vertexColorAttr ? `
in vec4 ${opts.vertexColorAttr};
//` : ''}

uniform mat4 u_view_proj;
uniform mat4 u_model_matrix;

//${opts.vertexColorAttr ? `
out vec4 v_color;
//` : ''}

void main() {
	gl_Position = u_view_proj * u_model_matrix * a_position;

//${opts.vertexColorAttr ? `
	v_color = ${opts.vertexColorAttr};
//` : ''}
}
