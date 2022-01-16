#version 300 es
precision mediump float;

//${opts.color ? `
uniform vec4 u_color;
//` : ''}

//${opts.vertexColorAttr ? `
in vec4 v_color;
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
}
