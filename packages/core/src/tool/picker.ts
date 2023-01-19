import { mat4, vec3, vec4 } from "gl-matrix"

import wrap from "../utils/worker"
import Geometry, { GeometryPrimitive, PlaneXY } from "../engine/geometry"
import Material, { BasicMaterial } from "../engine/material"
import Obj3, { Scene } from "../engine/obj3"
import Camera, { PerspectiveCamera } from "../engine/camera"
import { Mesh, Renderer, RendererOptions } from '../engine'
import { Texture } from "../engine/uniform"

import WorkerSelf from './picker?worker&inline'

interface WebGPUOffscreenCanvas extends
        Omit<OffscreenCanvas, 'getContext' | 'addEventListener' | 'removeEventListener'>,
        HTMLCanvasElement {
    transferToImageBitmap(): ImageBitmap
    convertToBlob(): Promise<Blob>
}

const cache = {
    inited: undefined as undefined | Promise<void>,
    created: undefined as undefined | ReturnType<typeof initCache>,
    scene: new Scene(),
    geoMap: { } as Record<number, Geometry>,
    matMap: [] as Material[],
    meshMap: [] as Mesh[],
}
async function initCache(canvas: WebGPUOffscreenCanvas, pixels: WebGPUOffscreenCanvas, opts?: RendererOptions) {
    const renderer = await Renderer.create(canvas, opts),
        camera = new PerspectiveCamera(),
        ctx = pixels.getContext('2d')
    if (!ctx) {
        throw Error(`get context 2d failed`)
    }
    return { renderer, camera, canvas, pixels, ctx }
}
async function getCache() {
    const ret = await cache.created
    if (!ret) {
        throw Error(`not started`)
    }
    return ret
}
async function readPixel({ x, y, w = 1, h = 1 }: { x: number, y: number, w?: number, h?: number }) {
    const { ctx, pixels, renderer, canvas } = await getCache(),
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
    clipPlane: vec4
    lineWidth: number
    offset: number
    count: number
}

export interface PickGeo {
    type: GeometryPrimitive
    positions: Float32Array
    normals?: Float32Array
    indices?: Uint16Array | Uint32Array
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
}

let renderLock = 0
async function renderDepth(meshes: Record<number, PickMesh>,
                geometries: Record<number, PickGeo>,
                { fov, aspect, near, far, worldMatrix }: PickCamera,
                { width, height }: { width: number, height: number }) {
    while (renderLock > Date.now() - 5000) {
        await new Promise(resolve => setTimeout(resolve, 10))
    }
    renderLock = Date.now()

    const { renderer, camera } = await getCache(),
        { scene, geoMap, matMap, meshMap } = cache
    renderer.width = width
    renderer.height = height

    scene.clear()
    Object.assign(camera, { fov, aspect, near, far })
    camera.setWorldMatrix(worldMatrix)
    const list = Object.values(meshes)
    for (const [index, { worldMatrix, geoId, offset, count, clipPlane, lineWidth }] of list.entries()) {
        if (!geometries[geoId] && !geoMap[geoId]) {
            throw Error(`geometry ${geoId} is not found`)
        }
        const geo = geoMap[geoId] || (geoMap[geoId] = new Geometry(geometries[geoId]!)),
            idx = index + 1,
            mat = matMap[idx] || (matMap[idx] = new BasicMaterial({
                entry: { frag: 'fragMainColor' },
                color: new Uint8Array([idx, idx >> 8, idx >> 16]),
            })),
            mesh = meshMap[idx] || (meshMap[idx] = new Mesh())
        mat.prop.lineWidth = lineWidth
        if (clipPlane) {
            mat.clip.assign(clipPlane)
        }
        Object.assign(mesh, { geo, mat, offset, count })
        mesh.setWorldMatrix(worldMatrix)
        scene.add(mesh)
    }
    if (scene.size >= 0xffff) {
        throw Error(`picker support ${0xffff} meshes at max`)
    }

    const { texture: depthTexture } = (textureCache.width === width && textureCache.height === height ?
        textureCache : Object.assign(textureCache, {
            width, height,
            texture: new Texture({
                size: { width: renderer.width, height: renderer.height, depthOrArrayLayers: 1 },
                usage: Texture.Usage.RENDER_ATTACHMENT | Texture.Usage.TEXTURE_BINDING,
                format: 'depth24plus-stencil8',
            }, {
                aspect: 'depth-only'
            })
        }))
    renderer.render(scene, camera, { depthTexture })
    renderLock = 0
    return { depthTexture, list }
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
        async init(canvas: WebGPUOffscreenCanvas, pixels: WebGPUOffscreenCanvas, opts?: RendererOptions) {
            await cache.created || (cache.created = initCache(canvas, pixels, opts))
        },
        async test({ geometries }: { geometries: number[] }) {
            return { geometries: geometries.filter(id => !cache.geoMap[id]) }
        },
        async query(meshes: Record<number, PickMesh>,
                     geometries: Record<number, PickGeo>,
                     camera: PickCamera,
                     { width, height }: { width: number, height: number }) {
            const { list } = await renderDepth(meshes, geometries, camera, { width, height }),
                indices = await readPixel({ x: 0, y: 0, w: width, h: height })
            return indices.map(idx => list[idx - 1]?.id).filter(id => id) as number[]
        },
        async pick(meshes: Record<number, PickMesh>,
                     geometries: Record<number, PickGeo>,
                     camera: PickCamera,
                     { width, height, x, y }: { x: number, y: number, width: number, height: number }) {
            const { depthTexture, list } = await renderDepth(meshes, geometries, camera, { width, height }),
                { renderer, pixels } = await getCache(),
                [idx = 0] = await readPixel({ x, y }),
                { id } = list[idx - 1] || { id: 0 }

            DEPTH_PLANE.mat = new BasicMaterial({ entry: { frag: 'fragMainDepth' }, texture: depthTexture }),
            renderer.render(DEPTH_SCENE, DEPTH_CAMERA)
            const [val = 0] = await readPixel({ x, y }),
                d = val / 0xffffff,
                // convert from webgpu range (0, 1) to opengl range(-1, 1)
                v = d * 2 - 1,
                // https://stackoverflow.com/a/66928245
                depth = 1 / (v * (1 / camera.near - 1 / camera.far) + 1 / camera.far)
            
            const [hw, hh, hf] = [width / 2, height / 2, camera.fov / 2],
                position = vec3.fromValues(
                    Math.tan(hf * camera.aspect) * (x - hw) / hw,
                    Math.tan(hf) * (y - hh) / -hh,
                    -1),
                distance = depth * vec3.len(position)
            vec3.normalize(position, position)
            vec3.scale(position, position, distance)
            vec3.transformMat4(position, position, camera.worldMatrix)

            const blob = await pixels.convertToBlob(),
                buffer = await blob.arrayBuffer()
            return { id, buffer, distance, position }
        }
    }
})

async function init() {
    const offscreen = document.createElement('canvas') as any,
        pixels = document.createElement('canvas') as any
    await worker.init(
        offscreen.transferControlToOffscreen() as WebGPUOffscreenCanvas,
        pixels.transferControlToOffscreen() as WebGPUOffscreenCanvas)
}

async function prepare(scene: Set<Obj3>, camera: PerspectiveCamera) {
    await (cache.created || (cache.inited = init()))
    const meshes = { } as Record<number, PickMesh>,
        geometries = { } as Record<number, PickGeo>
    camera.updateIfNecessary({ })
    for (const obj of scene) {
        obj.updateIfNecessary({ })
        obj.walk(obj => {
            if (obj instanceof Mesh && obj.geo && obj.mat) {
                const { worldMatrix, geo, id, mat, offset, count } = obj
                meshes[obj.id] = { worldMatrix, id, offset, count, clipPlane: mat.clip.data, geoId: geo.id, lineWidth: obj.mat.prop.lineWidth }
                const { type, positions, normals, indices } = geo
                geometries[geo.id] = { type, positions, normals, indices }
            }
        })
    }
    const { fov, aspect, near, far, worldMatrix } = camera,
        view = { fov, aspect, near, far, worldMatrix },
        cached = await worker.test({ geometries: Object.keys(geometries).map(parseFloat) }),
        geoms = Object.fromEntries(cached.geometries.map(id => [id, geometries[id]!]))
    return { meshes, geoms, view }
}

const Picker = {
    async query(scene: Set<Obj3>, camera: PerspectiveCamera, opts: {
        width: number
        height: number
    }) {
        const { meshes, geoms, view } = await prepare(scene, camera)
        view.fov *= 1.5
        return await worker.query(meshes, geoms, view, opts)
    },
    async pick(scene: Set<Obj3>, camera: PerspectiveCamera, opts: {
        width: number
        height: number
        x: number
        y: number
    }) {
        const { meshes, geoms, view } = await prepare(scene, camera)
        return await worker.pick(meshes, geoms, view, opts)
    }
}
export default Picker
