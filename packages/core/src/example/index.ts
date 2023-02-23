import Obj3, { Scene } from '../engine/obj3'
import Mesh from '../engine/mesh'
import Light from '../engine/light'
import Material, { BasicMaterial } from '../engine/material'
import Picker from '../tool/picker'
import { rand } from '../utils/math'
import { BoxGeometry, BoxLines, PlaneXY, Renderer, SphereGeometry, SpriteGeometry } from '../engine'
import { PerspectiveCamera } from '../engine/camera'
import { Control } from '../tool/control'
import { mat4, quat, vec4 } from 'gl-matrix'
import { Texture } from '../engine/uniform'

const elem = document.createElement('canvas')
elem.style.width = elem.style.height = '100%'
elem.oncontextmenu = () => false
document.body.appendChild(elem)
document.body.style.margin = document.body.style.padding = '0'
document.body.style.background = 'linear-gradient(45deg, black, transparent)'

const renderer = await Renderer.create(elem, { sampleCount: 4, useThree: location.search.includes('use-three') })

async function updatePivot({ x, y }: { x: number, y: number }) {
    const { id, position } = await Picker.pick(scene, camera, {
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

const seleted = new BasicMaterial({ color: [0, 1, 1], metallic: 0.1, roughness: 1, lineWidth: 10 }),
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
    const { id, buffer } = await Picker.pick(scene, camera, {
        width: elem.clientWidth,
        height: elem.clientHeight,
        x: evt.clientX,
        y: evt.clientY,
    })
    buffer
    if ((window as any).DEBUG_SHOW_CLICK_BUFFER) {
        /*
        const { buffer } = await Picker.clip(scene, camera, {
            width: elem.clientWidth,
            height: elem.clientHeight,
        })
         */
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

const CLIP_PLANE = vec4.fromValues(1, 0, 0, 20)

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
        aspect: elem.clientWidth / elem.clientHeight,
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
            wgsl: { frag: 'fragMainMultiDepth' },
            texture: new Texture({
                size: { width: renderer.canvas.width, height: renderer.canvas.height },
                format: 'depth24plus-stencil8',
                usage: Texture.Usage.TEXTURE_BINDING | Texture.Usage.COPY_DST | Texture.Usage.RENDER_ATTACHMENT,
                sampleCount: renderer.opts.sampleCount
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
    control = new Control(elem, camera, {
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

const mat = new BasicMaterial({ color: [Math.random(), Math.random(), Math.random(), 0.5] })
mat.clip.assign(CLIP_PLANE)
for (let i = 0; i < 10; i ++) {
    const { geo } = cube,
        mesh = new Mesh(geo, mat)
    mesh.scaling.set(rand(0.03, 0.3), rand(0.03, 0.3), rand(0.03, 0.3))
    mesh.position.set(rand(-200, 200), rand(-200, 200), rand(-200, 200))
    mesh.rotation.rotX(rand(0, 10)).rotY(rand(0, 10))
    scene.add(mesh)
}

renderer.width = elem.clientWidth
renderer.height = elem.clientHeight
window.addEventListener('resize', () => {
    camera.aspect = elem.clientWidth / elem.clientHeight
    renderer.width = elem.clientWidth
    renderer.height = elem.clientHeight
})

const depthScene = new Scene(Array.from(scene).filter(item => (item as Mesh).mat !== depthMaterial))
requestAnimationFrame(function render() {
    requestAnimationFrame(render)
    cube.rotation.rotX(0.02).rotY(0.03)
    handle.rotation.rotX(0.005)
    control.update()
    renderer.render(depthScene, camera, { depthTexture: depthMaterial.opts.texture, webgpu: { disableBundle: true } })
    renderer.render(scene, camera, { renderClips: true })
})
