import WebGPURenderer from '../engine/webgpu/renderer'
import Obj3, { Scene } from '../engine/obj3'
import Mesh from '../engine/mesh'
import Light from '../engine/light'
import Material, { BasicMaterial } from '../engine/material'
import Picker from '../tool/picker'
import { rand } from '../utils/math'
import { BoxGeometry, BoxLines, PlaneXY, SphereGeometry, SpriteGeometry } from '../engine'
import { PerspectiveCamera } from '../engine/camera'
import { Control } from '../tool/control'
import { mat4, quat, vec4 } from 'gl-matrix'
import { Texture } from '../engine/uniform'

(async function() {

const canvas = document.createElement('canvas')
canvas.style.width = canvas.style.height = '100%'
canvas.oncontextmenu = () => false
document.body.style.margin = document.body.style.padding = '0'
document.body.appendChild(canvas)

const renderer = await WebGPURenderer.create(canvas, { multisample: { count: 4 }, devicePixelRatio: 1 })
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
    seleted = new BasicMaterial({ color: [0, 1, 1], metallic: 0.1, roughness: 1, lineWidth: 10 }),
    oldMats = { } as Record<number, Material | undefined>
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

const CLIP_PLANE = vec4.fromValues(1, 1, 0, 0)
vec4.set(CLIP_PLANE, 0, 0, 0, 0)

const tex = document.createElement('canvas'),
    ctx = tex.getContext('2d')
tex.width = tex.height = 256
if (ctx) {
    ctx.font = '50px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Hello World', 128, 128)
}
const source = await createImageBitmap(tex)

let depthMaterial: Material

const camera = new PerspectiveCamera({
        fov: 5 / 180 * Math.PI,
        aspect: canvas.clientWidth / canvas.clientHeight,
        near: 1000,
        far: 20000,
        position: [0, 0, 5000]
    }),
    cube = new Mesh(
        new BoxGeometry({ size: 200 }),
        new BasicMaterial({ color: [0.9, 0.3, 0.2], roughness: 0.2, metallic: 1, clipPlane: CLIP_PLANE })),
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
        new Mesh(new SpriteGeometry({
            width: 300,
            height: 200,
            fixed: true
        }), new BasicMaterial({
            texture: new Texture({
                size: { width: tex.width, height: tex.height },
                format: 'rgba8unorm',
                usage: Texture.Usage.TEXTURE_BINDING | Texture.Usage.COPY_DST | Texture.Usage.RENDER_ATTACHMENT,
                source,
            }),
        }), {
            position: [0, 0, 160],
        }),
        new Mesh(new PlaneXY({
            size: 100,
        }), depthMaterial = new BasicMaterial({
            color: [1, 1, 1],
            entry: { frag: 'fragMainMultiDepth' },
            texture: new Texture({
                size: { width: renderer.width, height: renderer.height },
                format: 'depth24plus-stencil8',
                usage: Texture.Usage.TEXTURE_BINDING | Texture.Usage.COPY_DST | Texture.Usage.RENDER_ATTACHMENT,
                sampleCount: renderer.opts.multisample?.count
            }, {
                aspect: 'depth-only',
            }),
        }), {
            position: [0, 160, 160],
        }),
        new Mesh(new BoxLines({ size: 400 }), cube.mat),
        new Mesh(new BoxGeometry({ size: 20 }), new BasicMaterial({
            color: [0, 1, 0],
            renderOrder: 2,
        }), {
            position: [0, 200, 0],
        }),
        new Mesh(new BoxGeometry({ size: 20 }), new BasicMaterial({
            color: [1, 0, 0],
            renderOrder: 1,
        }), {
            position: [0, 200, 0],
        }),
    ]),
    control = new Control(canvas, camera, {
        pivot: new Mesh(new SphereGeometry(), new BasicMaterial()),
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
    vec4.copy(mat.clipPlane, CLIP_PLANE)
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

const depthScene = new Scene(Array.from(scene).filter(item => (item as Mesh).mat !== depthMaterial))
requestAnimationFrame(function render() {
    requestAnimationFrame(render)
    cube.rotation.rotX(0.02).rotY(0.03)
    handle.rotation.rotX(0.005)
    renderer.render(depthScene, camera, { depthTexture: depthMaterial.opts.texture, disableBundle: true })
    renderer.render(scene, camera)
})

document.body.style.background = 'linear-gradient(45deg, black, transparent)'

})()
