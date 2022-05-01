import WebGPURenderer from './engine/webgpu/renderer'
import Obj3 from './engine/obj3'
import Mesh from './engine/mesh'
import { rand } from './utils/math'
import { BasicMaterial } from './engine/material'
import { BoxGeometry, BoxLines, SphereGeometry } from './engine/geometry'
import { PerspectiveCamera } from './engine/camera'
import { DirectionalLight } from './engine/light'
import Picker from './engine/tool/picker'

(async function() {

const canvas = document.createElement('canvas')
canvas.style.width = canvas.style.height = '100%'
document.body.style.margin = document.body.style.padding = '0'
document.body.appendChild(canvas)

const renderer = await WebGPURenderer.create(canvas),
    scene = new Set<Obj3>()

const camera = new PerspectiveCamera(60 / 180 * Math.PI, canvas.clientWidth / canvas.clientHeight, 1, 2000),
    holder = new Obj3()
camera.position.set(0, 0, 600)
holder.add(camera)
scene.add(holder)

const cube = new Mesh(
    new BoxGeometry({ size: 200 }),
    new BasicMaterial({ color: [0.9, 0.3, 0.2], roughness: 0.2, metallic: 1 }))
scene.add(cube)

const line = new Mesh(
    new BoxLines({ size: 400 }),
    cube.mat)
scene.add(line)

const light = new DirectionalLight({ direction: [0, 0, -1], intensity: 5 }),
    handle = new Obj3()
light.position.set(0, 0, 300)
light.add(new Mesh(new SphereGeometry({ radius: 20 }), cube.mat))
handle.add(light)
scene.add(handle)

for (let i = 0; i < 500; i ++) {
    const { geo } = cube,
        mat = new BasicMaterial({ color: [Math.random(), Math.random(), Math.random(), 0.7] }),
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

requestAnimationFrame(function render() {
    requestAnimationFrame(render)
    cube.rotation.rotX(0.02).rotY(0.01)
    holder.rotation.rotY(0.001)
    handle.rotation.rotX(0.005)
    renderer.render(scene, camera)
})

const picker = await Picker.create()
canvas.addEventListener('click', async evt => {
    console.time('pick')
    const { buffer, id } = await picker.pick(scene, camera,
        { x: evt.clientX, y: evt.clientY },
        { width: canvas.clientWidth, height: canvas.clientHeight })
    console.timeEnd('pick')
    console.log('got', id)

    const image = document.createElement('img')
    await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
        image.src = URL.createObjectURL(new Blob([buffer]))
    })
    image.style.position = 'absolute'
    image.style.top = image.style.left = '0'
    image.addEventListener('click', () => document.body.removeChild(image))
    document.body.appendChild(image)
})

})()
