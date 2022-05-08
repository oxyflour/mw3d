import { Parser, Pmd, Vmd } from 'mmd-parser'
import { Engine } from '../../core'

const parser = new Parser()
async function start() {
    const url = 'http://localhost/threejs.org/examples/models/mmd/miku/miku_v2.pmd',
	    req = await fetch(url),
        buf = await req.arrayBuffer(),
		data = url.endsWith('.pmd') ? parser.parsePmd(buf) : parser.parsePmx(buf),
        canvas = document.createElement('canvas')
    document.body.style.margin = document.body.style.padding = '0'
    canvas.style.width = canvas.style.height = '100%'
    document.body.appendChild(canvas)

    const renderer = await Engine.Renderer.create(canvas),
        camera = new Engine.PerspectiveCamera({
            fov: 30 / 180 * Math.PI,
            aspect: canvas.clientWidth / canvas.clientHeight,
            near: 1,
            far: 200,
            position: [0, 0, 100]
        }),
        scene = new Engine.Scene([
            new Engine.Light({
                position: [-100, -100, -100]
            }),
            new Engine.Mesh(
                new Engine.Geometry({
                    positions: new Float32Array(data.vertices.map(item => item.position).flat()),
                    indices: new Uint32Array(data.faces.map(item => item.indices).flat()),
                    normals: new Float32Array(data.vertices.map(item => item.normal).flat()),
                }),
                new Engine.BasicMaterial({ }), {
                    position: [0, -10, 0]
                }
            )
        ])
    new Engine.Control(canvas, camera)
    requestAnimationFrame(function render() {
        requestAnimationFrame(render)
        renderer.render(scene, camera)
    })
}

start()
