import { Engine, Utils } from "@ttk/react"
import { Entity } from "../../../utils/data/entity"
import { ViewOpts } from "../../../utils/data/view"
import worker from "../../../utils/data/worker"

const [r = 0, g = 0, b = 0] = [1, 2, 3].map(() => Math.random())
export const MATERIAL_SET = {
    select:   new Engine.BasicMaterial({
        color: [1, .7, .7,  1], lineWidth: devicePixelRatio * 5,
        webgpu: { depthStencil: { depthBias: 1 } },
        webgl: { polygonOffset: { factor: -1 } },
        wgsl: { frag: 'fragMainColor' },
    }),
    selected: new Engine.BasicMaterial({
        color: [1,  0,  0,  1], lineWidth: devicePixelRatio * 5,
        webgpu: { depthStencil: { depthBias: 2 } }, wgsl: { frag: 'fragMainColorDash' },
        webgl: { polygonOffset: { factor: -2 } },
        metallic: 8, roughness: 6
    }),
    hover:    new Engine.BasicMaterial({
        color: [1,  1,  0,  1], lineWidth: devicePixelRatio * 3,
        webgpu: { depthStencil: { depthBias: 3 } }, wgsl: { frag: 'fragMainColorDash' },
        webgl: { polygonOffset: { factor: -3 } },
        metallic: 8, roughness: -2
    }),
    default:  new Engine.BasicMaterial({
        color: [r,  g,  b,  1], lineWidth: devicePixelRatio * 3
    }),
    dimmed:   new Engine.BasicMaterial({
        color: [r,  g,  b, .7], lineWidth: devicePixelRatio * 3
    })
}

const GEOMETRY_CACHE = new Utils.LRU<{ faces?: Engine.Geometry, edges?: Engine.LineList }>(10000)
export async function loadGeom(url: string) {
    return GEOMETRY_CACHE.get(url) || GEOMETRY_CACHE.set(url, (({ faces, edges }) => ({
        faces: faces && new Engine.Geometry(faces),
        edges: edges && new Engine.LineList(edges),
    }))(await worker.assets.get(url)))
}

const MATERIAL_CACHE = new Utils.LRU<{ default: Engine.Material, dimmed: Engine.Material }>()
export function loadMatSet(attrs: Entity['attrs'], mats: ViewOpts['mats']) {
    const mat = attrs?.$m || 'default',
        rgb = attrs?.$rgb || mats?.[mat]?.rgb,
        metal = mats?.[mat]?.metal
    if (rgb) {
        const { r, g, b } = rgb,
            metallic  = metal ? 1.0 : 0.1,
            roughness = metal ? 0.2 : 0.8,
            key = [r, g, b, metal].join(','),
            { opts } = MATERIAL_SET.default
        return MATERIAL_CACHE.get(key) || MATERIAL_CACHE.set(key, {
            default: new Engine.BasicMaterial({ ...opts, metallic, roughness, color: [r, g, b, 1.0] }),
            dimmed:  new Engine.BasicMaterial({ ...opts, metallic, roughness, color: [r, g, b, 0.4] }),
        })
    } else {
        return MATERIAL_SET
    }
}