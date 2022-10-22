import path from 'path'
import { mkdir, readFile, writeFile } from 'fs/promises'
import type { Shape } from '@yff/ncc'

import { pack } from '../../utils/common/pack'
import { Entity } from '../../utils/data/entity'
import { sha256 } from '../../utils/node/common'

export async function saveSolid(solid: Shape, root: string, file: string) {
    const { step, mesh } = await import('@yff/ncc'),
        { verts, faces, edges, geom } = mesh.topo(solid),
        { min, max } = solid.bound(),
        data = Math.random().toString(16).slice(2, 10)

    await mkdir(root, { recursive: true })
    step.save(path.join(root, data), solid)
    const hash = sha256(await readFile(path.join(root, data)))

    await mkdir(path.join(root, hash), { recursive: true })
    await writeFile(path.join(root, hash, 'geom'), pack({
        faces: geom,
        edges: { lines: edges.map(item => item.positions) }
    }))
    await writeFile(path.join(root, hash, 'faces'), pack(faces))
    await writeFile(path.join(root, hash, 'edges'), pack(edges))
    await writeFile(path.join(root, hash, 'verts'), pack((verts as any as any[]).map(item => ({ position: item.positions }))))

    const meta = solid.meta,
        rgb = (str: string) => Object.fromEntries(str.split(',').map((v, i) => [('rgb')[i], parseFloat(v)]))
    return {
        data: data,
        bound: [min.x, min.y, min.z, max.x, max.y, max.z],
        attrs: {
            $n: meta['ManifoldSolidBrep']?.replace(/\|/g, '/') ||
                path.basename(file) + '/' + data,
            $m: meta['LayerDescription'] || meta['LayerName'],
            $rgb: meta['ColorRGB'] && rgb(meta['ColorRGB']),
        },
        geom: { url: hash + '/geom' },
        topo: {
            faces: { url: hash + '/faces' },
            edges: { url: hash + '/edges' },
            verts: { url: hash + '/verts' },
        }
    } as Entity
}

export async function parse(file: string, save: string) {
    const { step, Shape } = await import('@yff/ncc'),
        dir = path.dirname(save),
        shapes = step.load(file),
        entities = [ ] as Entity[]
    for (const solid of shapes.find(Shape.types.SOLID)) {
        entities.push(await saveSolid(solid, dir, file))
    }
    return entities
}
