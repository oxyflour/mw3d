import WebGLRenderer from './engine/webgl2/renderer'
import WebGPURenderer from './engine/webgpu/renderer'
import Obj3 from './engine/obj3'
import Mesh from './engine/mesh'
import { BasicMaterial } from './engine/material'
import { BoxGeometry } from './engine/geometry'
import { PerspectiveCamera } from './engine/camera'

import Picker from './engine/webgl2/tool/picker'
import { rand } from './utils/math'
import { DirectionalLight } from './engine/light'

(async function() {

const canvas = document.createElement('canvas')
canvas.style.width = canvas.style.height = '100%'
document.body.style.margin = document.body.style.padding = '0'
document.body.appendChild(canvas)

// TODO
const renderer = 0 ? new WebGLRenderer(canvas) : await WebGPURenderer.create(canvas),
    scene = new Set<Obj3>(),
    camera = new PerspectiveCamera(60 / 180 * Math.PI, canvas.clientWidth / canvas.clientHeight, 1, 2000),
    holder = new Obj3()
holder.add(camera)
camera.position.set(0, 0, 500)
scene.add(holder)

const cube = new Mesh(
    new BoxGeometry({ size: 200 }),
    new BasicMaterial({ color: [0.9, 0.3, 0.2], vertexNormal: true }))
scene.add(cube)

const light = new DirectionalLight({ direction: [0, 0, -1] })
scene.add(light)

const mat = new BasicMaterial({ color: [0, 1, 1], vertexNormal: true })
for (let i = 0; i < 5000; i ++) {
    const { geo } = cube,
        mesh = new Mesh(geo, mat)
    mesh.scaling.set(rand(0.01, 0.1), rand(0.01, 0.1), rand(0.01, 0.1))
    mesh.position.set(rand(-200, 200), rand(-200, 200), rand(-200, 200))
    mesh.rotation.rotX(rand(0, 10)).rotY(rand(0, 10))
    scene.add(mesh)
}

renderer.width = canvas.clientWidth
renderer.height = canvas.clientHeight
window.addEventListener('resize', () => {
    camera.aspect = canvas.clientWidth / canvas.clientHeight
    renderer.width = canvas.clientWidth
    renderer.height = canvas.clientHeight
})

if (renderer instanceof WebGLRenderer) {
    const hovering = {
        mat: new BasicMaterial({ color: [1, 1, 0] }),
        mesh: undefined as undefined | Mesh & { originalMat: BasicMaterial }
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
}

requestAnimationFrame(function render() {
    requestAnimationFrame(render)
    cube.rotation.rotX(0.02).rotY(0.01)
    holder.rotation.rotY(0.001)
    light.rotation.rotX(0.02)
    renderer.render(scene, camera)
})

})()
