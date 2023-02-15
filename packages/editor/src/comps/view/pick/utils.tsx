import { CanvasContextValue, Engine, Tool, Utils } from "@ttk/react"
import lambda from "../../../lambda"
import { unpack } from "../../../utils/common/pack"
import { Entity } from "../../../utils/data/entity"
import { Edge, Face, Vert } from "../../../utils/data/topo"
import { ViewPickMode } from "../../../utils/data/view"
import { MATERIAL_SET } from "../loader/utils"

export const CAMERA_PIVOT = new Engine.Mesh(
    new Engine.SphereGeometry(),
    new Engine.BasicMaterial({
        color: [1, 0, 0, 0.5]
    }), {
        scaling: [0.1, 0.1, 0.1]
    })

export async function pick(
        { canvas, scene, camera }: CanvasContextValue,
        { clientX, clientY }: { clientX: number, clientY: number }) {
    if (!canvas || !scene || !camera) {
        throw Error(`renderer not initialized`)
    }
    const { left, top } = canvas.getBoundingClientRect(),
        list = new Set(Array.from(scene).filter(item => item !== CAMERA_PIVOT))
    return await Tool.Picker.pick(list, camera, {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        x: clientX - left,
        y: clientY - top,
    })
}

export async function query(
        { canvas, scene, camera }: CanvasContextValue) {
    if (!canvas || !scene || !camera) {
        throw Error(`renderer not initialized`)
    }
    const list = new Set(Array.from(scene).filter(item => item !== CAMERA_PIVOT))
    return await Tool.Picker.query(list, camera, {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
    })
}

export type Obj3WithEntity = Engine.Obj3 & { entity?: Entity }

async function loadEdges(url: string) {
    const edges = url ? unpack(await lambda.assets.get(url)) as Edge[] : [],
        slices = [] as { offset: number, count: number }[]
    let offset = 0
    for (const edge of edges) {
        const count = (edge.positions.length / 3 - 1) * 3 * 2
        slices.push({ offset, count })
        offset += count
    }
    const geo = new Engine.LineList({ lines: edges.map(edge => edge.positions) })
    return slices.map(({ offset, count }) => new Engine.Mesh(geo, MATERIAL_SET.select, { offset, count }))
}
async function loadFaces(url: string) {
    const faces = url ? unpack(await lambda.assets.get(url)) as Face[] : [],
        positions = [] as number[],
        indices = [] as number[],
        normals = [] as number[],
        slices = [] as { offset: number, count: number }[]
    for (const face of faces) {
        const start = positions.length / 3,
            offset = indices.length,
            count = face.indices.length
        positions.push(...face.positions)
        normals.push(...face.normals)
        indices.push(...Array.from(face.indices).map(item => item + start))
        slices.push({ offset, count })
    }
    const geo = new Engine.Geometry({
        positions: new Float32Array(positions),
        indices: new Uint32Array(indices),
        normals: new Float32Array(positions),
    })
    return slices.map(({ offset, count }) => new Engine.Mesh(geo, MATERIAL_SET.select, { offset, count }))
}
export async function loadVertGeom(url: string) {
    const verts = url ? unpack(await lambda.assets.get(url)) as Vert[] : [],
        positions = verts.map(item => item.position).flat(),
        geo = new Engine.SpriteGeometry({ positions, width: 50, height: 50, fixed: true })
    return { verts, geo }
}
async function loadVerts(url: string) {
    const { verts, geo } = await loadVertGeom(url)
    return verts.map((_, idx) => new Engine.Mesh(geo, MATERIAL_SET.select, { offset: idx * 6, count: 6 }))
}

const PICK_CACHE = new Utils.LRU<Promise<Engine.Mesh[]>>(100)
export function loadTopo(type: ViewPickMode, entity: Entity) {
    if (type === 'edge') {
        const url = entity.topo?.edges?.url || ''
        return PICK_CACHE.get(url) || PICK_CACHE.set(url, loadEdges(url))
    } else if (type === 'face') {
        const url = entity.topo?.faces?.url || ''
        return PICK_CACHE.get(url) || PICK_CACHE.set(url, loadFaces(url))
    } else if (type === 'vert') {
        const url = entity.topo?.verts?.url || ''
        return PICK_CACHE.get(url) || PICK_CACHE.set(url, loadVerts(url))
    } else {
        throw Error(`loading ${type} not implemented yet`)
    }
}
