import { mat4, vec3, vec4 } from "gl-matrix"

import wrap from "../utils/worker"
import Geometry, { GeometryPrimitive, PlaneXY } from "../engine/geometry"
import Material, { BasicMaterial } from "../engine/material"
import Obj3, { Scene } from "../engine/obj3"
import Camera, { PerspectiveCamera } from "../engine/camera"
import Mesh from "../engine/mesh"
import Renderer from "../engine/renderer"
import WebGPURenderer from "../engine/webgpu/renderer"
import WebGL2Renderer from "../engine/webgl2/renderer"
import { Texture } from "../engine/uniform"

import WorkerSelf from './picker?worker&inline'
import { queue } from "../utils/common"

interface WebGPUOffscreenCanvas extends
        Omit<OffscreenCanvas, 'getContext' | 'addEventListener' | 'removeEventListener' | 'oncontextlost' | 'oncontextrestored'>,
        HTMLCanvasElement {
    convertToBlob(): Promise<Blob>
}

interface PickContext {
    canvas: WebGPUOffscreenCanvas
    pixels: WebGPUOffscreenCanvas
    renderer: Renderer
    ctx: CanvasRenderingContext2D
}

let resolveContext = (_: PickContext) => { }
const cache = {
    inited: undefined as undefined | Promise<void>,
    context: new Promise<PickContext>(resolve => resolveContext = resolve),

    geoMap: { } as Record<number, Geometry & { accessedAt?: number }>,
    matMap: [] as Material[],
    meshMap: [] as Mesh[],
}

async function readPixel({ x, y, w = 1, h = 1 }: { x: number, y: number, w?: number, h?: number }) {
    const { ctx, pixels, renderer, canvas } = await cache.context,
        image = canvas.transferToImageBitmap()
    pixels.width = image.width
    pixels.height = image.height
    ctx.drawImage(image,
        0, 0, image.width, image.height,
        0, 0, renderer.width, renderer.height)
    const { data } = ctx.getImageData(x, y, w, h),
        ret = new Set<number>()
    for (let i = 0; i < data.length; i += 4) {
        const [r = 0xff, g = 0xff, b = 0xff] = [data[i], data[i + 1], data[i + 2]]
        if (r !== 0xff || g !== 0xff || b !== 0xff) {
            ret.add(r + (g << 8) + (b << 16))
        }
    }
    return Array.from(ret)
}

export interface PickMesh {
    id: number
    geoId: number 
    worldMatrix: mat4
    offset: number
    count: number
    clipPlane: vec4
    lineWidth: number
    transparent: boolean
}

export interface PickGeo {
    type: GeometryPrimitive
    positions: Float32Array
    normals?: Float32Array
    indices?: Uint16Array | Uint32Array
    min: number[]
    max: number[]
    accessedAt?: number
}

export interface PickCamera {
    fov: number
    aspect: number
    near: number
    far: number
    worldMatrix: mat4
}

const DEPTH_PLANE = new Mesh(new PlaneXY({ size: 1 })),
    DEPTH_SCENE = new Scene([DEPTH_PLANE]),
    DEPTH_CAMERA = new Camera()

const textureCache = {
    width: 0,
    height: 0,
    texture: undefined as undefined | Texture,
    material: undefined as undefined | Material
}
function makeTextureCache(width: number, height: number) {
    const texture = new Texture({
        size: { width, height, depthOrArrayLayers: 1 },
        usage: Texture.Usage.RENDER_ATTACHMENT | Texture.Usage.TEXTURE_BINDING,
        format: 'depth24plus-stencil8',
    }, {
        aspect: 'depth-only'
    })
    const material = new BasicMaterial({
        wgsl: { frag: 'fragMainDepth' },
        texture
    })
    return { width, height, texture, material }
}

async function prepareScene(meshes: Record<number, PickMesh>,
        geometries: Record<number, PickGeo>,
        { fov, aspect, near, far, worldMatrix }: PickCamera,
        { width, height }: { width: number, height: number }) {
    const { renderer } = await cache.context,
        { geoMap, matMap, meshMap } = cache
    renderer.width = width
    renderer.height = height

    const scene = new Scene(),
        camera = new PerspectiveCamera()
    Object.assign(camera, { fov, aspect, near, far })
    camera.setWorldMatrix(worldMatrix)

    const list = Object.values(meshes),
        accessedAt = Date.now()
    for (const [index, { worldMatrix, geoId, offset, count, clipPlane, lineWidth }] of list.entries()) {
        if (!geometries[geoId] && !geoMap[geoId]) {
            throw Error(`geometry ${geoId} is not found`)
        }
        const geo = geoMap[geoId] || (geoMap[geoId] = new Geometry(geometries[geoId]!)),
            idx = index + 1,
            mat = matMap[idx] || (matMap[idx] = new BasicMaterial({
                wgsl: { frag: 'fragMainColor' },
                color: new Uint8Array([idx, idx >> 8, idx >> 16]),
            })),
            mesh = meshMap[idx] || (meshMap[idx] = new Mesh())
        Object.assign(geo, { accessedAt })
        mat.prop.lineWidth = lineWidth
        if (clipPlane?.[0] || clipPlane?.[1] || clipPlane?.[2]) {
            mat.clip.assign(clipPlane)
        } else if (mat.needsClip) {
            mat.clip.assign([0, 0, 0, 0])
        }
        Object.assign(mesh, { geo, mat, offset, count })
        mesh.setWorldMatrix(worldMatrix)
        scene.add(mesh)
    }
    return { scene, camera, renderer, list }
}
async function renderClip(meshes: Record<number, PickMesh>,
        geometries: Record<number, PickGeo>,
        pick: PickCamera,
        { width, height }: { width: number, height: number }) {
    const { scene, camera, renderer } = await prepareScene(meshes, geometries, pick, { width, height })
    renderer.render(scene, camera, { renderClips: false })
}
async function renderDepth(meshes: Record<number, PickMesh>,
        geometries: Record<number, PickGeo>,
        pick: PickCamera,
        { width, height }: { width: number, height: number }) {
    const { scene, camera, renderer, list } = await prepareScene(meshes, geometries, pick, { width, height })
    if (scene.size >= 0xffff) {
        throw Error(`picker support ${0xffff} meshes at max`)
    }

    const { texture: depthTexture, material } =
        textureCache.width === width && textureCache.height === height ?
        textureCache : Object.assign(textureCache, makeTextureCache(width, height))

    renderer.render(scene, camera, { depthTexture })
    return { material, list, camera }
}

const runWithinMutex = queue((func: () => Promise<any>) => func())
function makeMutexFunc<F extends (...args: any[]) => Promise<any>>(func: F) {
    return ((...args: any[]) => runWithinMutex(() => func(...args))) as F
}

function expandBound([x0 = 0, y0 = 0, z0 = 0]: number[], [x1 = 0, y1 = 0, z1 = 0]: number[]) {
    return [
        [x0, y0, z0],
        [x1, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
        [x0, y0, z1],
        [x1, y0, z1],
        [x0, y1, z1],
        [x1, y1, z1],
    ] as [number, number, number][]
}

class Bound {
    min = vec3.fromValues( Infinity,  Infinity,  Infinity)
    max = vec3.fromValues(-Infinity, -Infinity, -Infinity)
    reset() {
        vec3.set(this.min, Infinity,  Infinity,  Infinity)
        vec3.set(this.max, -Infinity, -Infinity, -Infinity)
    }
    extend(pos: vec3) {
        vec3.min(this.min, this.min, pos)
        vec3.max(this.max, this.max, pos)
    }
    center(pos = vec3.create()) {
        vec3.scaleAndAdd(pos, pos, this.min, 0.5)
        vec3.scaleAndAdd(pos, pos, this.max, 0.5)
        return pos
    }
    size(pos = vec3.create()) {
        vec3.scaleAndAdd(pos, pos, this.min, -1)
        vec3.scaleAndAdd(pos, pos, this.max,  1)
        return pos
    }
}
const vec = vec4.create(),
    tmp = vec3.create()
function getGeoBound(geo: { min: number[], max: number[] }, mat: mat4, bound = new Bound()) {
    for (const [a, b, c] of expandBound(geo.min, geo.max)) {
        vec4.set(vec, a, b, c, 1.)
        vec4.transformMat4(vec, vec, mat)
        const [x = 0, y = 0, z = 0, w = 0] = vec
        vec3.set(tmp, x / w, y / w, z / w)
        bound.extend(tmp)
    }
    return bound
}

const worker = wrap({
    num: 1,
    // @ts-ignore
    fork: () => new (WorkerSelf as any)(),
    send: async (args, next) => {
        const transfer = args.filter(arg => arg?.constructor?.name === 'OffscreenCanvas')
        return await next(args, transfer)
    },
    api: {
        async init(canvas: WebGPUOffscreenCanvas, pixels: WebGPUOffscreenCanvas) {
            const opts = { devicePixelRatio: 1, sampleCount: 1 },
                renderer =
                    navigator.gpu ?
                        await WebGPURenderer.create(canvas, opts) :
                        new WebGL2Renderer(canvas, opts),
                ctx = pixels.getContext('2d', { willReadFrequently: true })
            if (!ctx) {
                throw Error(`get context 2d failed`)
            }
            resolveContext({ canvas, pixels, renderer, ctx })
        },
        async test({ geometries }: { geometries: number[] }) {
            const required = [] as number[],
                now = Date.now(),
                timeout = now - 60 * 1000
            for (const id of geometries) {
                const item = cache.geoMap[id]
                if (item) {
                    item.accessedAt = now
                } else {
                    required.push(id)
                }
            }
            for (const key of Object.keys(cache.geoMap)) {
                const id = parseInt(key),
                    current = cache.geoMap[id]?.accessedAt || now
                if (current < timeout) {
                    delete cache.geoMap[id]
                }
            }
            return { geometries: required }
        },
        clip: makeMutexFunc(async (meshes: Record<number, PickMesh>,
                   geometries: Record<number, PickGeo>,
                   camera: PickCamera,
                   { width, height }: { width: number, height: number }) => {
            await renderClip(meshes, geometries, camera, { width, height })
            await readPixel({ x: 0, y: 0 })
            const { pixels } = await cache.context,
                blob = await pixels.convertToBlob(),
                buffer = await blob.arrayBuffer()
            return { buffer }
        }),
        async bound(meshes: Record<number, PickMesh>,
                    geometries: Record<number, PickGeo>,
                    { fov, aspect, near, far, worldMatrix }: PickCamera) {
            const camera = new PerspectiveCamera()
            Object.assign(camera, { fov, aspect, near, far })
            camera.setWorldMatrix(worldMatrix)

            const ndc = new Bound(),
                world = new Bound(),
                { viewProjection } = camera,
                mat = mat4.create()
            for (const { worldMatrix, geoId } of Object.values(meshes)) {
                const geo = geometries[geoId] || cache.geoMap[geoId]
                if (geo) {
                    getGeoBound(geo, worldMatrix, world)
                    mat4.multiply(mat, viewProjection, worldMatrix)
                    getGeoBound(geo, mat, ndc)
                }
            }

            const compute = (bound: Bound) => ({ ...bound, center: bound.center(), size: bound.size() })
            return { ndc: compute(ndc), world: compute(world) }
        },
        async query(meshes: Record<number, PickMesh>,
                    geometries: Record<number, PickGeo>,
                    view: PickCamera,
                    { width, height }: { width: number, height: number }) {
            const opaque = { } as typeof meshes,
                transclude = { } as typeof meshes
            for (const mesh of Object.values(meshes)) {
                (mesh.transparent ? transclude : opaque)[mesh.id] = mesh
            }
            const { camera, ids } = await runWithinMutex(async () => {
                const { list, camera } = await renderDepth(opaque, geometries, view, { width, height }),
                    read = await readPixel({ x: 0, y: 0, w: width, h: height }),
                    ids = read.map(idx => list[idx - 1]?.id).filter(id => id) as number[]
                return { camera, ids }
            })
            const { viewProjection } = camera,
                mat = mat4.create(),
                bound = new Bound()
            for (const { worldMatrix, geoId, id } of Object.values(transclude)) {
                const geo = geometries[geoId] || cache.geoMap[geoId]
                if (geo) {
                    bound.reset()
                    mat4.multiply(mat, viewProjection, worldMatrix)
                    getGeoBound(geo, mat, bound)
                    const { min: [x0 = 0, y0 = 0], max: [x1 = 0, y1 = 0] } = bound
                    if (-1 < x1 && x0 < 1 &&
                        -1 < y1 && y0 < 1) {
                        ids.push(id)
                    }
                }
            }
            return { ids }
        },
        pick: makeMutexFunc(async (meshes: Record<number, PickMesh>,
                     geometries: Record<number, PickGeo>,
                     camera: PickCamera,
                     { width, height, x, y }: { x: number, y: number, width: number, height: number }) => {
            const { material, list } = await renderDepth(meshes, geometries, camera, { width, height }),
                { renderer, pixels } = await cache.context,
                [idx = 0] = await readPixel({ x, y }),
                { id } = list[idx - 1] || { id: 0 },
                { near = 0, far = 1, fov = 1, aspect = 1 } = camera

            DEPTH_PLANE.mat = material
            renderer.render(DEPTH_SCENE, DEPTH_CAMERA)
            const [val = 0] = await readPixel({ x, y }),
                d = val / 0xffffff,
                // convert from webgpu range (0, 1) to opengl range(-1, 1)
                v = d * 2 - 1,
                // https://stackoverflow.com/a/66928245
                depth = 1 / (v * (1 / near - 1 / far) + 1 / far)
            
            const [hw, hh, hf] = [width / 2, height / 2, Math.tan(fov / 2)],
                position = vec3.fromValues(
                    hf * aspect * (x - hw) / hw,
                    hf * (y - hh) / -hh,
                    -1),
                distance = depth * vec3.len(position)
            vec3.normalize(position, position)
            vec3.scale(position, position, distance)
            vec3.transformMat4(position, position, camera.worldMatrix)

            const blob = await pixels.convertToBlob(),
                buffer = await blob.arrayBuffer()
            return { id, buffer, distance, position }
        }),
    }
})

async function init() {
    const offscreen = document.createElement('canvas') as any,
        pixels = document.createElement('canvas') as any
    await worker.init(
        offscreen.transferControlToOffscreen() as WebGPUOffscreenCanvas,
        pixels.transferControlToOffscreen() as WebGPUOffscreenCanvas)
}

async function prepare(scene: Set<Obj3>, camera: Camera) {
    await (cache.inited || (cache.inited = init()))
    const meshes = { } as Record<number, PickMesh>,
        geometries = { } as Record<number, PickGeo>
    camera.updateIfNecessary({ })
    for (const obj of scene) {
        obj.updateIfNecessary({ })
        obj.walk(obj => {
            if (obj instanceof Mesh && obj.geo && obj.mat) {
                const { worldMatrix, geo, id, mat, offset, count } = obj,
                    { lineWidth, a } = mat.prop,
                    clipPlane = mat.clip.data,
                    transparent = a < 1
                meshes[obj.id] = { worldMatrix, id, offset, count, clipPlane, lineWidth, transparent, geoId: geo.id }
                const { type, positions, normals, indices, min, max } = geo
                geometries[geo.id] = { type, positions, normals, indices, min, max }
            }
        })
    }
    const { fov, aspect, near, far, worldMatrix } = camera as PerspectiveCamera,
        view = { fov, aspect, near, far, worldMatrix },
        cached = await worker.test({ geometries: Object.keys(geometries).map(parseFloat) }),
        geoms = Object.fromEntries(cached.geometries.map(id => [id, geometries[id]!]))
    return { meshes, geoms, view }
}

export interface Size {
    width: number
    height: number
}

export default {
    async query(scene: Set<Obj3>, camera: PerspectiveCamera, opts: Size) {
        const { meshes, geoms, view } = await prepare(scene, camera)
        return await worker.query(meshes, geoms, view, opts)
    },
    async pick(scene: Set<Obj3>, camera: PerspectiveCamera, opts: Size & {x: number, y: number }) {
        const { meshes, geoms, view } = await prepare(scene, camera)
        return await worker.pick(meshes, geoms, view, opts)
    },
    async clip(scene: Set<Obj3>, camera: PerspectiveCamera, opts: Size) {
        const { meshes, geoms, view } = await prepare(scene, camera)
        return await worker.clip(meshes, geoms, view, opts)
    },
    async bound(scene: Set<Obj3>, camera: PerspectiveCamera) {
        const { meshes, geoms, view } = await prepare(scene, camera)
        return await worker.bound(meshes, geoms, view)
    },
}
