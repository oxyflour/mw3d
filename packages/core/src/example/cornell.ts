import { mat4, quat } from 'gl-matrix'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import WebRTXRenderer from '../engine/webrtx/renderer'

// @ts-ignore
import cBoxBack from './assets/cbox_back.obj?raw'
// @ts-ignore
import cBoxCeiling from './assets/cbox_ceiling.obj?raw'
// @ts-ignore
import cBoxFloor from './assets/cbox_floor.obj?raw'
// @ts-ignore
import cBoxGreenWall from './assets/cbox_greenwall.obj?raw'
// @ts-ignore
import cBoxLargeBox from './assets/cbox_largebox.obj?raw'
// @ts-ignore
import cBoxLuminaire from './assets/cbox_luminaire.obj?raw'
// @ts-ignore
import cBoxRedWall from './assets/cbox_redwall.obj?raw'

// @ts-ignore
import diffuseRchit from './shaders/diffuse.rchit?raw'
// @ts-ignore
import shadowRahit from './shaders/shadow.rahit?raw'
// @ts-ignore
import mirrorRchit from './shaders/mirror.rchit?raw'
// @ts-ignore
import glassRchit from './shaders/glass.rchit?raw'

import { BasicMaterial, Geometry, Mesh, PerspectiveCamera, Renderer, Scene, SphereGeometry } from '../engine'
import { Control, Picker } from '../tool'

const elem = document.createElement('canvas')
elem.style.width = elem.style.height = '100%'
elem.oncontextmenu = () => false
document.body.appendChild(elem)
document.body.style.margin = document.body.style.padding = '0'
document.body.style.background = 'linear-gradient(45deg, black, transparent)'

const renderer = location.search.includes('use-webrtx') ?
    await WebRTXRenderer.create(elem, { sampleCount: 4 }) :
    await Renderer.create(elem, {
        sampleCount: 4,
        useThree: location.search.includes('use-three'),
        useWebGL2: location.search.includes('use-webgl2'),
        useTracer: location.search.includes('use-tracer'),
    })

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

const camera = new PerspectiveCamera({
        fov: 39 / 180 * Math.PI,
        aspect: elem.clientWidth / elem.clientHeight,
        near: 1,
        far: 2000,
        position: [278, 273, -800],
        rotation: [0, Math.PI, 0]
    }),
    control = new Control(elem, camera, {
        hooks: {
            mouse: async (evt, next) => {
                updatePivot({ x: evt.clientX, y: evt.clientY })
                await next(evt)
            },
            wheel: async (evt, next) => {
                updatePivot({ x: evt.clientX, y: evt.clientY })
                await next(evt)
            },
        }
    }),
    scene = new Scene(),
    materials = {
        box: new BasicMaterial({
            webrtx: [ /* radiance ray */ {
                "rchit": diffuseRchit,
                "shaderRecord": [{
                    "type": "vec4",
                    "data": [0, 0, 0, 0] /* vec3(light radiance), float(inv_area) */
                }, {
                    "type": "vec3",
                    "data": [0.65, 0.65, 0.65] /* albedo */
                }]
            }, /* shadow ray */ {
                "rahit": shadowRahit
            }]
        }),
        white: new BasicMaterial({
            webrtx: [ /* radiance ray */ {
                "rchit": diffuseRchit,
                "shaderRecord": [{
                    "type": "vec4" as 'vec4',
                    "data": [0, 0, 0, 0] /* vec3(light radiance), float(inv_area) */
                }, {
                    "type": "vec3" as 'vec3',
                    "data": [0.65, 0.65, 0.65] /* albedo */
                }]
            }, /* shadow ray */ {
                "rahit": shadowRahit
            }]
        }),
        red: new BasicMaterial({
            webrtx: [ /* radiance ray */ {
                "rchit": diffuseRchit,
                "shaderRecord": [{
                    "type": "vec4" as 'vec4',
                    "data": [0, 0, 0, 0] /* vec3(light radiance), float(inv_area) */
                }, {
                    "type": "vec3" as 'vec3',
                    "data": [1.0, 0.0, 0.0] /* albedo */
                }]
            }, /* shadow ray */ {
                "rahit": shadowRahit
            }]
        }),
        green: new BasicMaterial({
            webrtx: [ /* radiance ray */ {
                "rchit": diffuseRchit,
                "shaderRecord": [{
                    "type": "vec4",
                    "data": [0, 0, 0, 0] /* vec3(light radiance), float(inv_area) */
                }, {
                    "type": "vec3",
                    "data": [0.0, 1.0, 0.0] /* albedo */
                }]
            }, /* shadow ray */ {
                "rahit": shadowRahit
            }]
        }),
        light: new BasicMaterial({
            webrtx: [ /* radiance ray */ {
                "rchit": diffuseRchit,
                "shaderRecord": [{
                    "type": "vec4",
                    "data": [15.6, 15.6, 15.6, 7.33e-5] /* vec3(light radiance), float(inv_area) */
                }, {
                    "type": "vec3",
                    "data": [0.78, 0.78, 0.78] /* albedo */
                }]
            }, /* shadow ray */ {
                "rahit": shadowRahit
            }]
        }),
        mirror: new BasicMaterial({
            webrtx: [ /* radiance ray */ {
                "rchit": mirrorRchit,
                "shaderRecord": [{
                    "type": "vec3", // KR
                    "data": [0.65, 0.65, 0.65]
                }]
            }, /* shadow ray */ {
                "rahit": shadowRahit
            }]
        }),
        glass: new BasicMaterial({
            webrtx: [ /* radiance ray */ {
                "rchit": glassRchit,
                "shaderRecord": [{
                    "type": "vec3", // KR
                    "data": [0.65, 0.65, 0.65]
                }, {
                    "type": "vec3", // KT
                    "data": [0.65, 0.65, 0.65]
                }, {
                    "type": "vec2",
                    "data": [1.0, 1.5] // etai, etat
                }]
            }, /* shadow ray */ {
                "rahit": shadowRahit
            }]
        })
    }

const loader = new OBJLoader()
for (const [obj, mat] of Object.entries({
    [cBoxCeiling]  : materials.white,
    [cBoxLuminaire]: materials.light,
    [cBoxBack]     : materials.white,
    [cBoxFloor]    : materials.white,
    [cBoxGreenWall]: materials.green,
    [cBoxRedWall]  : materials.red,
    [cBoxLargeBox] : materials.mirror,
})) {
    const group = loader.parse(obj),
        geo = (group.children[0] as THREE.Mesh).geometry,
        positions = geo.getAttribute('position').array as Float32Array
    scene.add(new Mesh(new Geometry({
        type: 'triangle-list',
        positions,
        normals: new Float32Array(Array(positions.length).fill(0)),
        indices: geo.getIndex()?.array as Uint32Array,
    }), mat))
}
scene.add(new Mesh(new SphereGeometry(), materials.glass, {
    position: [160, 100, 150],
    scaling: [100, 100, 100]
}))

renderer.width = elem.clientWidth
renderer.height = elem.clientHeight
window.addEventListener('resize', () => {
    camera.aspect = elem.clientWidth / elem.clientHeight
    renderer.width = elem.clientWidth
    renderer.height = elem.clientHeight
})

requestAnimationFrame(function render() {
    requestAnimationFrame(render)
    control.update()
    renderer.render(scene, camera)
})
