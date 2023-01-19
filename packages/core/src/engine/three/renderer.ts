import * as THREE from 'three'
import cache from '../../utils/cache'
import Camera, { PerspectiveCamera } from '../camera'
import Geometry from '../geometry'
import Light from '../light'
import Material from '../material'
import Mesh from '../mesh'
import Obj3, { Scene } from '../obj3'
import Renderer, { RendererOptions, RenderOptions } from '../renderer'
import { Texture } from '../uniform'

class ThreeDepthMaterial extends THREE.ShaderMaterial {
    constructor(parameters?: THREE.ShaderMaterialParameters) {
        super({
            vertexShader: `
                varying vec4 vPos;
                void main() {
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    vPos = (gl_Position + 1.) * .5;
                }
            `,
            fragmentShader: `
                #include <packing>
                varying vec4 vPos;
                uniform sampler2D tDepth;
                void main() {
                    float v = texture2D(tDepth, vPos.xy).x;
                    v = 1. - v / 2.;
                    uint i = uint(v * float(0x1000000));
                    uint r = (i & 0x0000ffu);
                    uint g = (i & 0x00ff00u) >> 8u;
                    uint b = (i & 0xff0000u) >> 16u;
                    gl_FragColor = vec4(
                        float(r) / 255.,
                        float(g) / 255.,
                        float(b) / 255.,
                        1.);
                }
            `,
            uniforms: {
                tDepth: { value: null },
            },
            ...parameters
        })
    }
}

export default class ThreeRenderer extends Renderer {
    private readonly renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        alpha: true,
        antialias: true,
    })
    constructor(canvas: HTMLCanvasElement | OffscreenCanvas, opts = { } as RendererOptions) {
        super(canvas, opts)
        this.renderer.localClippingEnabled = true
    }
    private geo = cache((geo: Geometry) => {
        const ret = new THREE.BufferGeometry()
        ret.setAttribute('position', new THREE.Float32BufferAttribute(geo.positions, 3))
        geo.normals && ret.setAttribute('normal', new THREE.Float32BufferAttribute(geo.normals, 3))
        geo.indices && ret.setIndex(new THREE.BufferAttribute(geo.indices, 1))
        return ret
    })
    private mat = cache((mat: Material) => {
        const { r, g, b, a, roughness, metallic } = mat.prop
        const ret =
            mat.opts.entry.frag === 'fragMainColor' ?
                new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) }) :
            mat.opts.entry.frag === 'fragMainDepth' ?
                new ThreeDepthMaterial() :
                new THREE.MeshPhysicalMaterial({
                    color: new THREE.Color(r, g, b),
                    transparent: a < 1,
                    opacity: a,
                    roughness: roughness,
                    metalness: metallic,
                    emissive: new THREE.Color(r, g, b).multiplyScalar(0.5),
                })
        return ret
    })
    private ct = cache((tex: Texture) => {
        const { width, height = width } = tex.opts.size as GPUExtent3DDictStrict,
            canvas = document.createElement('canvas'),
            ctx = canvas.getContext('2d'),
            image = tex.opts.source
        canvas.width = width
        canvas.height = height
        if (ctx && image) {
            ctx.drawImage(image,
                0, 0, image.width, image.height,
                0, 0, canvas.width, canvas.height)
        }
        return new THREE.CanvasTexture(canvas)
    })
    private dt = cache((tex: Texture) => {
        const { width, height = width } = tex.opts.size as GPUExtent3DDictStrict,
            ret = new THREE.DepthTexture(width, height)
        ret.format = THREE.DepthFormat
        ret.type = THREE.UnsignedIntType
        return ret
    })
    private rt = cache((tex: Texture) => {
        const { width, height = width } = tex.opts.size as GPUExtent3DDictStrict
        return new THREE.WebGLRenderTarget(width, height, {
            depthBuffer: true,
            depthTexture: this.dt(tex),
        })
    })
    private obj3 = cache((obj3: Obj3) => {
        return obj3 instanceof Mesh ? new THREE.Mesh() :
            obj3 instanceof Light ? new THREE.PointLight() :
            new THREE.Object3D()
    })
    private cam = cache((camera: Camera) => {
        return camera instanceof PerspectiveCamera ?
            new THREE.PerspectiveCamera(camera.fov / Math.PI * 180, camera.aspect, camera.near, camera.far) :
            new THREE.Camera()
    })
    private clip = cache((mat: Material) => {
        const { x, y, z, w } = mat.clip
        return new THREE.Plane(new THREE.Vector3(x, y, z), w)
    })
    private readonly sizeCache = { width: 0, height: 0 }
    private readonly threeClearColor = new THREE.Color()
    private readonly scene = new THREE.Scene()
    private camera = new THREE.Camera()
    override render(scene: Scene, camera: Camera, opts = { } as RenderOptions) {
        const { width, height } = this
        if (width != this.sizeCache.width || height != this.sizeCache.height) {
            this.renderer.setSize(width, height, false)
            Object.assign(this.sizeCache, { width, height })
        }

        this.threeClearColor.setRGB(this.clearColor.r, this.clearColor.g, this.clearColor.b)
        this.renderer.setClearColor(this.threeClearColor)
        this.renderer.setClearAlpha(this.clearColor.a)

        this.camera = this.cam(camera)
        this.camera.position.set(camera.position.x, camera.position.y, camera.position.z)
        this.camera.scale.set(camera.scaling.x, camera.scaling.y, camera.scaling.z)
        this.camera.quaternion.set(camera.rotation.x, camera.rotation.y, camera.rotation.z, camera.rotation.w)
        if (camera instanceof PerspectiveCamera && this.camera instanceof THREE.PerspectiveCamera) {
            this.camera.fov = camera.fov / Math.PI * 180
            this.camera.near = camera.near
            this.camera.far = camera.far
            this.camera.aspect = camera.aspect
        }

        this.scene.clear()
        scene.walk((obj, parent) => {
            const item = this.obj3(obj)
            item.position.set(obj.position.x, obj.position.y, obj.position.z)
            item.scale.set(obj.scaling.x, obj.scaling.y, obj.scaling.z)
            item.quaternion.set(obj.rotation.x, obj.rotation.y, obj.rotation.z, obj.rotation.w)
            if (obj instanceof Mesh) {
                const mesh = item as THREE.Mesh
                mesh.renderOrder = obj.renderOrder
                obj.geo && (mesh.geometry = this.geo(obj.geo))
                if (obj.mat) {
                    const mat = mesh.material = this.mat(obj.mat),
                        tex = obj.mat.opts.texture
                    mat.clippingPlanes = obj.mat.needsClip ? [this.clip(obj.mat)] : null
                    if (tex) {
                        if (mat instanceof ThreeDepthMaterial) {
                            mat.uniforms.tDepth!.value = this.dt(tex)
                        } else if (mat instanceof THREE.MeshPhysicalMaterial) {
                            mat.map = this.ct(tex)
                        }
                    }
                }
            }
            if (parent) {
                this.obj3(parent).add(item)
            } else {
                this.scene.add(item)
            }
        })

        if (opts.depthTexture) {
            this.renderer.setRenderTarget(this.rt(opts.depthTexture))
            this.renderer.render(this.scene, this.camera)
            this.renderer.setRenderTarget(null)
        }
        this.renderer.autoClear = !opts.keepFrame
        this.renderer.render(this.scene, this.camera)
    }
}
