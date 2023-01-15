import path from 'path'
import os from 'os'
import { mkdir, readFile, unlink } from 'fs/promises'
import type { Shape } from '@yff/ncc'

import { Entity } from '../../utils/data/entity'
import { Chunks } from '../../utils/node/chunks'

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

export async function parse(chunks: Chunks, file: string) {
    const { step, Shape } = await import('@yff/ncc'),
        shapes = step.load(file),
        solids = shapes.find(Shape.types.SOLID),
        entities = [ ] as Entity[],
        batch = os.cpus().length
    for (let i = 0; i < solids.length; i += batch) {
        await Promise.all(solids.slice(i, i + batch).map(async solid => {
            const ent = await saveSolid(solid, file)
            entities.push({
                ...ent,
                data: chunks.append(ent.data),
                geom: chunks.append(ent.geom),
                topo: {
                    faces: chunks.append(ent.topo.faces),
                    edges: chunks.append(ent.topo.edges),
                    verts: chunks.append(ent.topo.verts),
                }
            })
        }))
    }
    return entities
}
