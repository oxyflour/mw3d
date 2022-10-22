import { CanvasContextValue, Engine, Tool, Utils } from "@ttk/react"
import lambda from "../../../lambda"
import { unpack } from "../../../utils/common/pack"
import { Entity } from "../../../utils/data/entity"
import { Edge, Face, Vert } from "../../../utils/data/topo"
import { ViewPickMode } from "../../../utils/data/view"

const FRAG_DASH = `
fn fragMainColorDash(input: FragInput) -> @location(0) vec4<f32> {
    if (WGSL_IGNORE_UNUSED) {
        var a = lightNum;
        var b = lights;
        var c = canvasSize;
    }
    checkClip(input);
    var n = material.metallic;
    var v = material.roughness;
    var s = input.position.xy - floor(input.position.xy / n) * n;
    if (v > 0.) {
        if (s.x > v || s.y > v) {
            discard;
        }
    } else if (v < 0.) {
        if (s.x < -v || s.y < -v) {
            discard;
        }
    }
    return material.color;
}
`

const [r = 0, g = 0, b = 0] = [1, 2, 3].map(() => Math.random())
export const MATERIAL_SET = {
    select:   new Engine.BasicMaterial({ color: [1, .7, .7, 1], lineWidth: devicePixelRatio * 5, entry: { frag: 'fragMainColor' } }),
    selected: new Engine.BasicMaterial({ color: [1, 0, 0, 1.0], lineWidth: devicePixelRatio * 5, entry: { frag: FRAG_DASH }, metallic: 8, roughness: 6 }),
    hover:    new Engine.BasicMaterial({ color: [1, 1, 0, 1.0], lineWidth: devicePixelRatio * 3, entry: { frag: FRAG_DASH }, metallic: 8, roughness: -2 }),
    default:  new Engine.BasicMaterial({ color: [r, g, b, 1.0], lineWidth: devicePixelRatio * 3, emissive: 0.2 }),
    dimmed:   new Engine.BasicMaterial({ color: [r, g, b, 0.7], lineWidth: devicePixelRatio * 3 })
}

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
    const picker = await Tool.Picker.init(),
        { left, top } = canvas.getBoundingClientRect(),
        list = new Set(Array.from(scene).filter(item => item !== CAMERA_PIVOT))
    return await picker.pick(list, camera, {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
        x: clientX - left,
        y: clientY - top,
    })
}

export type Obj3WithEntity = Engine.Obj3 & { entity?: Entity }

const PICK_CACHE = new Utils.LRU<Engine.Mesh[]>(100)
export async function loadTopo(type: ViewPickMode, entity: Entity) {
    if (type === 'edge') {
        const url = entity.topo?.edges?.url || ''
        return PICK_CACHE.get(url) || PICK_CACHE.set(url,
            (url ? unpack(await lambda.assets.get(url)) as Edge[] : [])
                .map(data => new Engine.Mesh(new Engine.LineList({ lines: [data.positions] }), MATERIAL_SET.select)))
    } else if (type === 'face') {
        const url = entity.topo?.faces?.url || ''
        return PICK_CACHE.get(url) || PICK_CACHE.set(url,
            (url ? unpack(await lambda.assets.get(url)) as Face[] : [])
                .map(data => new Engine.Mesh(new Engine.Geometry(data), MATERIAL_SET.select)))
    } else if (type === 'vert') {
        const url = entity.topo?.verts?.url || ''
        return PICK_CACHE.get(url) || PICK_CACHE.set(url,
            (url ? unpack(await lambda.assets.get(url)) as Vert[] : [])
                .map(data => new Engine.Mesh(new Engine.SpriteGeometry({ ...data, width: 50, height: 50, fixed: true }), MATERIAL_SET.select)))
    } else {
        throw Error(`loading ${type} not implemented yet`)
    }
}
