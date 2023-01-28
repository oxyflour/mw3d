import * as THREE from 'three'
import cache from '../../utils/cache'
import Camera, { PerspectiveCamera } from '../camera'
import Geometry, { GeometryPrimitive } from '../geometry'
import Light from '../light'
import Material from '../material'
import Mesh from '../mesh'
import Obj3, { Scene } from '../obj3'
import Renderer, { RendererOptions, RenderOptions } from '../renderer'
import { Texture } from '../uniform'

import glsl from './shader.glsl?raw'

const GLSL_CHUNKS = { } as Record<string, Record<string, string>>
for (const chunk of (glsl as string).split('// @chunk:')) {
    const name = chunk.slice(0, chunk.indexOf('\n')).trim(),
        map = GLSL_CHUNKS[name] = { } as Record<string, string>
    for (const part of chunk.split('// @')) {
        const head = part.slice(0, part.indexOf('\n')),
            name = head.trim()
        if (name) {
            map[name] = part.slice(head.length)
        }
    }
}

class DepthMaterial extends THREE.ShaderMaterial {
    constructor(parameters?: THREE.ShaderMaterialParameters) {
        super({
            vertexShader:   GLSL_CHUNKS.depth?.vert + '',
            fragmentShader: GLSL_CHUNKS.depth?.frag + '',
            uniforms: { tDepth: { value: null } },
            ...parameters
        })
    }
}

class FatLineMaterial extends THREE.ShaderMaterial {
    constructor(parameters?: THREE.ShaderMaterialParameters) {
        super({
            vertexShader:   GLSL_CHUNKS.line?.vert + '',
            fragmentShader: GLSL_CHUNKS.line?.frag + '',
            defines: {
            },
            uniforms: {
                vResolution: { value: new THREE.Vector2() },
                fLineWidth: { value: 2 },
                vColor: { value: new THREE.Vector3() },
            },
            ...parameters
        })
    }
}

class SpriteMaterial extends THREE.ShaderMaterial {
    constructor(parameters?: THREE.ShaderMaterialParameters) {
        super({
            vertexShader:   GLSL_CHUNKS.sprite?.vert + '',
            fragmentShader: GLSL_CHUNKS.sprite?.frag + '',
            defines: {
            },
            uniforms: {
                vResolution: { value: new THREE.Vector2() },
                tMap: { value: null },
            },
            ...parameters
        })
    }
}

export default class ThreeRenderer extends Renderer {
    private readonly renderer: THREE.WebGLRenderer
    constructor(canvas: HTMLCanvasElement | OffscreenCanvas, opts = { } as RendererOptions) {
        super(canvas, opts)
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: opts.sampleCount! > 1,
        })
        this.renderer.localClippingEnabled = true
    }
    private geo = cache((geo: Geometry) => {
        const ret = new THREE.BufferGeometry()
        ret.setAttribute('position', new THREE.Float32BufferAttribute(geo.positions, 3))
        geo.normals && ret.setAttribute('normal', new THREE.Float32BufferAttribute(geo.normals, 3))
        geo.indices && ret.setIndex(new THREE.BufferAttribute(geo.indices, 1))
        return ret
    })
    private mat = cache((primitive: GeometryPrimitive, mat: Material) => {
        const { r, g, b, a, roughness, metallic } = mat.prop
        const ret =
            primitive === 'fat-line-list' ?
                new FatLineMaterial() :
            primitive === 'point-sprite' ?
                new SpriteMaterial() :
            mat.opts.entry.frag === 'fragMainColor' ?
                new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) }) :
            mat.opts.entry.frag === 'fragMainDepth' ?
                new DepthMaterial() :
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
    override resize() {
        super.resize()
        this.renderer.setSize(this.renderSize.width, this.renderSize.height, false)
    }
    private readonly threeClearColor = new THREE.Color()
    private readonly scene = new THREE.Scene()
    private revs = { } as Record<number, number>
    override render(scene: Scene, camera: Camera, opts = { } as RenderOptions) {
        super.render(scene, camera, opts)

        camera.updateIfNecessary(this.revs)
        for (const obj of scene) {
            obj.updateIfNecessary(this.revs)
        }

        this.threeClearColor.setRGB(this.clearColor.r, this.clearColor.g, this.clearColor.b)
        this.renderer.setClearColor(this.threeClearColor)
        this.renderer.setClearAlpha(this.clearColor.a)

        const c = this.cam(camera)
        c.position.set(camera.position.x, camera.position.y, camera.position.z)
        c.scale.set(camera.scaling.x, camera.scaling.y, camera.scaling.z)
        c.quaternion.set(camera.rotation.x, camera.rotation.y, camera.rotation.z, camera.rotation.w)
        if (camera instanceof PerspectiveCamera && c instanceof THREE.PerspectiveCamera) {
            c.fov = camera.fov / Math.PI * 180
            c.near = camera.near
            // Note: threejs matrix DOES NOT support infinity far plane
            c.far = camera.far === Infinity ? c.near * 1e9 : camera.far
            c.aspect = camera.aspect
            c.updateProjectionMatrix()
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
                mesh.visible = obj.isVisible
                obj.geo && (mesh.geometry = this.geo(obj.geo))
                if (obj.mat) {
                    const mat = mesh.material = this.mat(obj.geo?.type || 'triangle-list', obj.mat)
                    mat.clippingPlanes = obj.mat.needsClip ? [this.clip(obj.mat)] : null
                    if (mat instanceof FatLineMaterial) {
                        const { width, height, devicePixelRatio } = this,
                            { lineWidth, r, g, b } = obj.mat.prop
                        mat.uniforms.vResolution!.value.set(width * devicePixelRatio, height * devicePixelRatio)
                        mat.uniforms.fLineWidth!.value = lineWidth
                        mat.uniforms.vColor!.value.set(r, g, b)
                    } else if (mat instanceof SpriteMaterial) {
                        const { width, height, devicePixelRatio } = this
                        mat.uniforms.vResolution!.value.set(width * devicePixelRatio, height * devicePixelRatio)
                    } else if (mat instanceof THREE.MeshPhysicalMaterial) {
                        mat.metalness = obj.mat.prop.metallic
                        mat.roughness = obj.mat.prop.roughness
                    }

                    const tex = obj.mat.opts.texture
                    if (tex) {
                        if (mat instanceof DepthMaterial) {
                            mat.uniforms.tDepth!.value = this.dt(tex)
                        } else if (mat instanceof SpriteMaterial) {
                            mat.uniforms.tMap!.value = this.ct(tex)
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
            this.renderer.render(this.scene, c)
            this.renderer.setRenderTarget(null)
        }
        this.renderer.autoClear = !opts.keepFrame
        this.renderer.render(this.scene, c)
    }
}
