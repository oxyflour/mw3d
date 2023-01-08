import path from 'path'
import os from 'os'
import { mkdir, readFile, unlink } from 'fs/promises'
import type { Shape } from '@yff/ncc'

import { pack } from '../../utils/common/pack'
import { Entity } from '../../utils/data/entity'

export class BufferList {
    constructor(readonly arr = [] as Uint8Array[]) {
    }
    private offset = 0
    append(data: any) {
        const buf = data instanceof Uint8Array ? data : pack(data),
            ret = { offset: this.offset, size: buf.byteLength }
        this.arr.push(buf)
        this.offset += buf.byteLength
        return ret
    }
}

function rgb(str: string) {
    return Object.fromEntries(str.split(',').map((v, i) => [('rgb')[i], parseFloat(v)]))
}

export async function saveSolid(solid: Shape, file: string) {
    const { step, mesh } = await import('@yff/ncc'),
        { verts, faces, edges, geom } = mesh.topo(solid),
        { min, max } = solid.bound(),
        root = os.tmpdir(),
        rand = Math.random().toString(16).slice(2, 10)
    await mkdir(root, { recursive: true })
    step.save(path.join(root, rand), solid)

    const data = await readFile(path.join(root, rand))
    await unlink(path.join(root, rand))
    return {
        data,
        bound: [min.x, min.y, min.z, max.x, max.y, max.z] as Entity['bound'],
        attrs: {
            ...solid.meta,
            $n: solid.meta['ManifoldSolidBrep']?.replace(/\|/g, '/') || path.basename(file) + '/' + data,
            $m: solid.meta['LayerDescription'] || solid.meta['LayerName'],
            $rgb: solid.meta['ColorRGB'] && rgb(solid.meta['ColorRGB']),
        },
        geom: {
            faces: geom,
            edges: { lines: edges.map(item => item.positions) }
        },
        topo: {
            faces,
            edges,
            verts: (verts as any as any[]).map(item => ({ position: item.positions })),
        }
    }
}

export async function parse(bufs: BufferList, file: string) {
    const { step, Shape } = await import('@yff/ncc'),
        shapes = step.load(file),
        entities = [ ] as Entity[]
    for (const solid of shapes.find(Shape.types.SOLID)) {
        const ent = await saveSolid(solid, file)
        entities.push({
            ...ent,
            data: bufs.append(ent.data),
            geom: bufs.append(ent.geom),
            topo: {
                faces: bufs.append(ent.topo.faces),
                edges: bufs.append(ent.topo.edges),
                verts: bufs.append(ent.topo.verts),
            }
        })
    }
    return entities
}
