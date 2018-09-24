import 'babel-polyfill'

import Renderer from './engine/renderer'
import Obj3 from './engine/obj3'
import Mesh from './engine/mesh'
import { BoxGeometry } from './engine/geometry'
import { PerspectiveCamera } from './engine/camera'
import Material, { BasicMaterial } from './engine/material'

import { rand } from './utils/math'

const canvas = document.createElement('canvas')
canvas.style.width = canvas.style.height = '100%'
document.body.style.margin = document.body.style.padding = '0'
document.body.appendChild(canvas)

const renderer = new Renderer(canvas),
    camera = new PerspectiveCamera(60 / 180 * Math.PI, canvas.clientWidth / canvas.clientHeight, 1, 2000),
    scene = new Set<Obj3>()

camera.pos.set(0, 0, 300)
const cube = new Mesh(
    new BoxGeometry({ size: 100 }),
    new BasicMaterial({ color: [1, 0, 0] }))
scene.add(cube)

const mat = new BasicMaterial({ color: [0, 1, 1] })
for (let i = 0; i < 100; i ++) {
    const { geo } = cube,
        mesh = new Mesh(geo, mat)
    mesh.scl.set(rand(0.1, 0.5), rand(0.1, 0.5), rand(0.1, 0.5))
    mesh.pos.set(rand(-1000, 1000), rand(-1000, 1000), rand(-1000, -500))
    mesh.rot.rotX(rand(0, 10)).rotY(rand(0, 10))
    scene.add(mesh)
}

renderer.width = canvas.clientWidth
renderer.height = canvas.clientHeight
window.addEventListener('resize', () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight
    renderer.width = canvas.clientWidth
    renderer.height = canvas.clientHeight
})

const hovering = {
    mat: new BasicMaterial({ color: new Float32Array([1, 1, 0]) }),
    mesh: undefined as undefined | Mesh & { originalMat: Material }
}
renderer.canvas.addEventListener('mousemove', evt => {
    const x = evt.clientX,
        y = window.innerHeight - evt.clientY,
        mesh = renderer.pick(scene, camera, x, y)
    if (hovering.mesh !== mesh) {
        if (hovering.mesh) {
            hovering.mesh.mat = hovering.mesh.originalMat
        }
        if (hovering.mesh = mesh as any) {
            hovering.mesh.originalMat = hovering.mesh.mat
            hovering.mesh.mat = hovering.mat
        }
    }
})

requestAnimationFrame(function render() {
    requestAnimationFrame(render)
    cube.rot.rotX(0.02).rotY(0.01)
    renderer.render(scene, camera)
})

declare var module: any
if (module && module.hot) {
    module.hot.dispose(() => location.reload())
}
