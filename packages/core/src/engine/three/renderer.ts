import * as THREE from 'three'
import cache from '../../utils/cache'
import { parse } from '../../utils/chunk'
import Camera, { PerspectiveCamera } from '../camera'
import Geometry, { GeometryPrimitive } from '../geometry'
import Light from '../light'
import Material from '../material'
import Mesh from '../mesh'
import Obj3, { Scene } from '../obj3'
import Renderer, { RendererOptions, RenderOptions } from '../renderer'
import { Texture } from '../uniform'

import glsl from './shader.glsl?raw'
const GLSL_CHUNKS = parse(glsl)

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
    private subGeo = cache((geo: Geometry, start: number, count: number) => {
        const item = this.geo(geo).clone()
        item.setDrawRange(start, count)
        return item
    })
    private geo = cache((geo: Geometry) => {
        const ret = new THREE.BufferGeometry()
        ret.setAttribute('position', new THREE.Float32BufferAttribute(geo.positions, 3))
        geo.normals && ret.setAttribute('normal', new THREE.Float32BufferAttribute(geo.normals, 3))
        geo.indices && ret.setIndex(new THREE.BufferAttribute(geo.indices, 1))
        return ret
    })
    private mat = cache((primitive: GeometryPrimitive, mat: Material) => {
        const { r, g, b, a, roughness, metallic } = mat.prop,
            { polygonOffset } = mat.opts.webgl || { },
            hasPolygonOffset = polygonOffset?.units !== undefined || polygonOffset?.factor !== undefined,
            opts = {
                ...(hasPolygonOffset ? {
                    polygonOffset: true,
                    polygonOffsetFactor: polygonOffset?.factor || 0,
                    polygonOffsetUnits: polygonOffset?.units || 0,
                } : null)
            }
        const ret =
            primitive === 'triangle-list' && mat.opts.wgsl?.frag === 'fragMainColorDash' ?
                new THREE.ShaderMaterial({
                    ...opts,
                    vertexShader:   GLSL_CHUNKS.dash?.vert,
                    fragmentShader: GLSL_CHUNKS.dash?.frag,
                    uniforms: {
                        renderCanvasSize: { value: new THREE.Vector2() },
                        materialColor: { value: new THREE.Vector4() },
                        materialProp: { value: new THREE.Vector4() },
                    },
                }) :
            primitive === 'fat-line-list' && mat.opts.wgsl?.frag === 'fragMainColorDash' ?
                new THREE.ShaderMaterial({
                    ...opts,
                    vertexShader:   GLSL_CHUNKS.line?.vert,
                    fragmentShader: GLSL_CHUNKS.line?.frag,
                    uniforms: {
                        renderCanvasSize: { value: new THREE.Vector2() },
                        materialColor: { value: new THREE.Vector4() },
                        materialProp: { value: new THREE.Vector4() },
                    },
                }) :
            primitive === 'point-sprite' && (mat.opts.wgsl?.frag === 'fragMainColor' || mat.opts.wgsl?.frag === 'fragMainColorDash') ?
                new THREE.ShaderMaterial({
                    ...opts,
                    vertexShader:   GLSL_CHUNKS.sprite?.vert,
                    fragmentShader: GLSL_CHUNKS.line?.frag,
                    uniforms: {
                        renderCanvasSize: { value: new THREE.Vector2() },
                        materialColor: { value: new THREE.Vector4() },
                        materialMap: { value: null },
                    },
                }) :
            primitive === 'fat-line-list' ?
                new THREE.ShaderMaterial({
                    ...opts,
                    vertexShader:   GLSL_CHUNKS.line?.vert,
                    fragmentShader: GLSL_CHUNKS.line?.frag,
                    uniforms: {
                        renderCanvasSize: { value: new THREE.Vector2() },
                        materialColor: { value: new THREE.Vector4() },
                        materialProp: { value: new THREE.Vector4() },
                    },
                }) :
            primitive === 'point-sprite' ?
                new THREE.ShaderMaterial({
                    ...opts,
                    vertexShader:   GLSL_CHUNKS.sprite?.vert,
                    fragmentShader: GLSL_CHUNKS.sprite?.frag,
                    uniforms: {
                        renderCanvasSize: { value: new THREE.Vector2() },
                        materialColor: { value: new THREE.Vector4() },
                        materialMap: { value: null },
                    },
                }) :
            mat.opts.wgsl?.frag === 'fragMainColor' ?
                new THREE.MeshBasicMaterial({
                    ...opts,
                    color: new THREE.Color(r, g, b)
                }) :
            mat.opts.wgsl?.frag === 'fragMainDepth' ?
                new THREE.ShaderMaterial({
                    vertexShader:   GLSL_CHUNKS.depth?.vert,
                    fragmentShader: GLSL_CHUNKS.depth?.frag,
                    uniforms: { materialMapDepth: { value: null } },
                }) :
                new THREE.MeshPhysicalMaterial({
                    ...opts,
                    color: new THREE.Color(r, g, b),
                    transparent: a < 1,
                    opacity: a,
                    roughness: roughness,
                    metalness: metallic,
                    emissive: new THREE.Color(r, g, b).multiplyScalar(mat.prop.emissive),
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
            // https://github.com/mrdoob/three.js/issues/11755
            c.far = camera.far === Infinity ? c.near * 1e9 : camera.far
            c.aspect = camera.aspect
            c.updateProjectionMatrix()
        }

        const s = new THREE.Scene()
        scene.walk((obj, parent) => {
            const item = this.obj3(obj)
            item.clear()
            item.position.set(obj.position.x, obj.position.y, obj.position.z)
            item.scale.set(obj.scaling.x, obj.scaling.y, obj.scaling.z)
            item.quaternion.set(obj.rotation.x, obj.rotation.y, obj.rotation.z, obj.rotation.w)
            if (obj instanceof Mesh) {
                const mesh = item as THREE.Mesh
                mesh.renderOrder = obj.renderOrder
                mesh.visible = obj.isVisible
                if (obj.geo) {
                    if (obj.offset !== 0 || obj.count !== -1) {
                        mesh.geometry = this.subGeo(obj.geo, obj.offset, obj.count)
                    } else {
                        mesh.geometry = this.geo(obj.geo)
                    }
                }
                if (obj.mat) {
                    const mat = mesh.material = this.mat(obj.geo?.type || 'triangle-list', obj.mat)
                    mat.clippingPlanes = obj.mat.needsClip ? [this.clip(obj.mat)] : null
                    const { width, height, devicePixelRatio } = this,
                        { lineWidth, metallic, roughness, emissive, r, g, b, a } = obj.mat.prop
                    mat.transparent = a < 1
                    if (mat instanceof THREE.ShaderMaterial) {
                        const { uniforms: { renderCanvasSize, materialColor, materialProp } } = mat
                        renderCanvasSize?.value.set(width * devicePixelRatio, height * devicePixelRatio)
                        materialColor?.value.set(r, g, b, a)
                        materialProp?.value.set(roughness * devicePixelRatio, metallic * devicePixelRatio, lineWidth, emissive)
                    } else if (mat instanceof THREE.MeshPhysicalMaterial) {
                        mat.metalness = metallic
                        mat.roughness = roughness
                        mat.emissive.setRGB(r * emissive, g * emissive, b * emissive)
                    }

                    const tex = obj.mat.opts.texture
                    if (tex) {
                        if (mat instanceof THREE.ShaderMaterial) {
                            const { uniforms: { materialMapDepth, materialMap } } = mat
                            materialMapDepth && (materialMapDepth.value = this.dt(tex))
                            materialMap && (materialMap.value = this.ct(tex))
                        } else if (mat instanceof THREE.MeshPhysicalMaterial) {
                            mat.map = this.ct(tex)
                        }
                    }
                }
            }
            if (parent) {
                this.obj3(parent).add(item)
            } else {
                s.add(item)
            }
        })

        if (opts.depthTexture) {
            this.renderer.setRenderTarget(this.rt(opts.depthTexture))
            this.renderer.render(s, c)
            this.renderer.setRenderTarget(null)
        }
        this.renderer.autoClear = !opts.keepFrame
        this.renderer.render(s, c)
    }
}
