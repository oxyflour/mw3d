import WebGPURenderer from '../engine/webgpu/renderer'
import Obj3, { Scene } from '../engine/obj3'
import Mesh from '../engine/mesh'
import Light from '../engine/light'
import Material, { BasicMaterial } from '../engine/material'
import Picker from '../tool/picker'
import { rand } from '../utils/math'
import { BoxGeometry, BoxLines, SphereGeometry } from '../engine/geometry'
import { PerspectiveCamera } from '../engine/camera'
import { Control } from '../tool/control'
import { mat4, quat } from 'gl-matrix'

(async function() {

const canvas = document.createElement('canvas')
canvas.style.width = canvas.style.height = '100%'
document.body.style.margin = document.body.style.padding = '0'
document.body.appendChild(canvas)

const renderer = await WebGPURenderer.create(canvas)
async function updatePivot({ x, y }: { x: number, y: number }) {
    const { id, position } = await picker.pick(scene, camera, {
        width: renderer.width,
        height: renderer.height,
        x, y,
    })
    if (id > 0) {
        const rot = quat.create(),
            { pivot } = control
        mat4.fromRotationTranslation(pivot.worldMatrix, rot, position)
        pivot.setWorldMatrix(pivot.worldMatrix)
    }
}

const picker = await Picker.init(),
    seleted = new BasicMaterial({ color: [0, 1, 1], metallic: 0.1, roughness: 1 }),
    oldMats = { } as Record<number, Material>
async function showBuffer(buffer: ArrayBuffer) {
    const image = document.createElement('img')
    image.src = URL.createObjectURL(new Blob([buffer]))
    await image.decode()
    image.style.position = 'absolute'
    image.style.top = image.style.left = '0'
    image.addEventListener('click', () => document.body.removeChild(image))
    document.body.appendChild(image)
}
async function clickScene(evt: MouseEvent) {
    const { id, buffer } = await picker.pick(scene, camera, {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        x: evt.clientX,
        y: evt.clientY,
    })
    if ((window as any).DEBUG_SHOW_CLICK_BUFFER) {
        await showBuffer(buffer)
    }
    scene.walk(obj => {
        if (obj instanceof Mesh && obj.id === id) {
            const mat = oldMats[id]
            if (mat) {
                obj.mat = mat
                delete oldMats[id]
            } else {
                oldMats[id] = obj.mat
                obj.mat = seleted
            }
        }
    })
}

const camera = new PerspectiveCamera({
        fov: 5 / 180 * Math.PI,
        aspect: canvas.clientWidth / canvas.clientHeight,
        near: 1000,
        far: 20000,
        position: [0, 0, 5000]
    }),
    cube = new Mesh(
        new BoxGeometry({ size: 200 }),
        new BasicMaterial({ color: [0.9, 0.3, 0.2], roughness: 0.2, metallic: 1 })),
    handle = new Obj3({
        children: [
            new Light({
                position: [0, 300, 0],
                children: [
                    new Mesh(new SphereGeometry({ radius: 20 }), cube.mat)
                ]
            })
        ]
    }),
    scene = new Scene([
        cube,
        handle,
        new Mesh(
            new BoxLines({ size: 400 }),
            cube.mat),
    ]),
    control = new Control(canvas, camera, {
        pivot: new Mesh(new SphereGeometry({ }), new BasicMaterial({ })),
        zoom: {
            distance: {
                min: camera.near + 2000,
                max: camera.far - 2000,
            }
        },
        hooks: {
            mouse: async (evt, next) => {
                updatePivot({ x: evt.clientX, y: evt.clientY })
                await next(evt)
            },
            wheel: async (evt, next) => {
                updatePivot({ x: evt.clientX, y: evt.clientY })
                await next(evt)
            },
            click: clickScene
        }
    })

for (let i = 0; i < 100; i ++) {
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
    cube.rotation.rotX(0.02).rotY(0.03)
    handle.rotation.rotX(0.005)
    renderer.render(scene, camera)
})

})()
