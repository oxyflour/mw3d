import * as THREE from 'three'
import cache from '../../utils/cache'
import Camera, { PerspectiveCamera } from '../camera'
import Geometry from '../geometry'
import Light from '../light'
import Material from '../material'
import Mesh from '../mesh'
import Obj3, { Scene } from '../obj3'
import { Texture } from '../uniform'

export default class ThreeRenderer {
    private readonly renderer: THREE.WebGLRenderer
    constructor(
        public readonly canvas: HTMLCanvasElement | OffscreenCanvas,
        public readonly opts = { } as {
            size?: { width: number, height: number }
            devicePixelRatio?: number
            adaptorOptions?: GPURequestAdapterOptions
            deviceDescriptor?: GPUDeviceDescriptor
            canvasConfig?: GPUCanvasConfiguration
            multisample?: GPUMultisampleState
        }) {
        const cv = canvas as HTMLCanvasElement
        if (cv.clientWidth && cv.clientHeight) {
            cv.width = cv.clientWidth
            cv.height = cv.clientHeight
        }
        this.renderer = new THREE.WebGLRenderer({ canvas: canvas as any, alpha: true })
    }
    geo = cache((geo: Geometry) => {
        const ret = new THREE.BufferGeometry()
        ret.setAttribute('position', new THREE.Float32BufferAttribute(geo.positions, 3))
        geo.normals && ret.setAttribute('normal', new THREE.Float32BufferAttribute(geo.normals, 3))
        geo.indices && ret.setIndex(new THREE.BufferAttribute(geo.indices, 1))
        return ret
    })
    mat = cache((mat: Material) => {
        const { r, g, b, a, roughness, metallic } = mat.prop
        const ret = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(r, g, b),
            transparent: a < 1,
            opacity: a,
            roughness: roughness,
            metalness: metallic,
            emissive: new THREE.Color(r, g, b).multiplyScalar(0.5),
        })
        return ret
    })
    obj3 = cache((obj3: Obj3) => {
        return obj3 instanceof Mesh ? new THREE.Mesh() :
            obj3 instanceof Light ? new THREE.PointLight() :
            new THREE.Object3D()
    })
    camera = cache((camera: Camera) => {
        return camera instanceof PerspectiveCamera ?
            new THREE.PerspectiveCamera(camera.fov / Math.PI * 180, camera.aspect, camera.near, camera.far) :
            new THREE.Camera()
    })
    width = 0
    height = 0
    readonly clearColor = { r: 0, g: 0, b: 0, a: 0 }
    render(scene: Scene, camera: Camera, opts = { } as {
        depthTexture?: Texture
        colorTexture?: Texture
    }) {
        this.renderer.setClearColor(new THREE.Color(this.clearColor.r, this.clearColor.g, this.clearColor.b), this.clearColor.a)
        const s = new THREE.Scene()
        scene.walk((obj, parent) => {
            const item = this.obj3(obj)
            item.position.set(obj.position.x, obj.position.y, obj.position.z)
            item.scale.set(obj.scaling.x, obj.scaling.y, obj.scaling.z)
            item.quaternion.set(obj.rotation.x, obj.rotation.y, obj.rotation.z, obj.rotation.w)
            if (obj instanceof Mesh) {
                const mesh = item as THREE.Mesh
                mesh.renderOrder = obj.renderOrder
                obj.geo && (mesh.geometry = this.geo(obj.geo))
                obj.mat && (mesh.material = this.mat(obj.mat))
            }
            if (parent) {
                this.obj3(parent).add(item)
            } else {
                s.add(item)
            }
        })
        const c = this.camera(camera)
        c.position.set(camera.position.x, camera.position.y, camera.position.z)
        c.scale.set(camera.scaling.x, camera.scaling.y, camera.scaling.z)
        c.quaternion.set(camera.rotation.x, camera.rotation.y, camera.rotation.z, camera.rotation.w)
        if (camera instanceof PerspectiveCamera && c instanceof THREE.PerspectiveCamera) {
            c.fov = camera.fov / Math.PI * 180
            c.near = camera.near
            c.far = camera.far
            c.aspect = camera.aspect
        }
        // TODO
        opts
        this.renderer.render(s, c)
    }
}
