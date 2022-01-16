import Renderer from './engine/renderer'
import Obj3 from './engine/obj3'
import Mesh from './engine/mesh'
import { BoxGeometry } from './engine/geometry'
import { PerspectiveCamera } from './engine/camera'
import Material, { BasicMaterial } from './engine/material'

import { rand } from './utils/math'
import Picker from './tool/pick'
import { DirectionalLight } from './engine/light'

const canvas = document.createElement('canvas')
canvas.style.width = canvas.style.height = '100%'
document.body.style.margin = document.body.style.padding = '0'
document.body.appendChild(canvas)

const renderer = new Renderer(canvas),
    scene = new Set<Obj3>()

const camera = new PerspectiveCamera(60 / 180 * Math.PI, canvas.clientWidth / canvas.clientHeight, 1, 2000),
    holder = new Obj3()
holder.add(camera)
camera.pos.set(0, 0, 500)
scene.add(holder)

const cube = new Mesh(
    new BoxGeometry({ size: 200 }),
    new BasicMaterial({ color: [1, 0, 0], vertexNormalAttr: 'a_normal' }))
scene.add(cube)

const light = new DirectionalLight({ direction: [0, 0, -1] })
scene.add(light)

for (let i = 0; i < 100; i ++) {
    const { geo } = cube,
        color = [Math.random(), Math.random(), Math.random()],
        mat = new BasicMaterial({ color, vertexNormalAttr: 'a_normal' }),
        mesh = new Mesh(geo, mat)
    mesh.scl.set(rand(0.1, 0.5), rand(0.1, 0.5), rand(0.1, 0.5))
    mesh.pos.set(rand(-200, 200), rand(-200, 200), rand(-200, 200))
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
    mat: new BasicMaterial({ color: [1, 1, 0] }),
    mesh: undefined as undefined | Mesh & { originalMat: Material }
}
const picker = new Picker(renderer)
renderer.canvas.addEventListener('mousemove', evt => {
    const x = evt.clientX,
        y = window.innerHeight - evt.clientY,
        mesh = picker.pick(scene, camera, x, y)
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
    holder.rot.rotY(0.001)
    light.rot.rotX(0.02)
    renderer.render(scene, camera)
})
