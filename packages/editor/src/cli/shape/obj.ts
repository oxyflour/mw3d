import { readFile } from "fs/promises"
import { Entity } from "../../utils/data/entity"
import { Chunks } from "../../utils/node/chunks"
import path from "path"

export async function parse(chunks: Chunks, file: string) {
    const content = await readFile(file, 'utf-8'),
        verts = [] as number[],
        faces = [] as number[],
        min = { x:  Infinity, y:  Infinity, z:  Infinity },
        max = { x: -Infinity, y: -Infinity, z: -Infinity }
    for (const line of content.split('\n')) {
        if (line[0] == 'v') {
            const [, a, b, c] = line.split(/\s/)
            if (a && b && c) {
                const [x, y, z] = [parseFloat(a), parseFloat(b), parseFloat(c)]
                verts.push(x, y, z)
                max.x = Math.max(max.x, x)
                max.y = Math.max(max.y, y)
                max.z = Math.max(max.z, z)
                min.x = Math.min(min.x, x)
                min.y = Math.min(min.y, y)
                min.z = Math.min(min.z, z)
            }
        }
    }
    const edges = { } as Record<number, [number, number]>
    for (const line of content.split('\n')) {
        if (line[0] == 'f') {
            const [, i, j, k] = line.split(/\s/)
            if (i && j && k) {
                const [u, v, w] = [parseInt(i) - 1, parseInt(j) - 1, parseInt(k) - 1]
                faces.push(u, v, w)
                for (const [a = 0, b = 0] of [[u, v], [v, w], [w, u]]) {
                    const [u, v] = [Math.min(a, b), Math.max(a, b)]
                    edges[u + v * verts.length] = [u, v]
                }
            }
        }
    }
    return [{
        attrs: {
            $n: path.basename(file),
            $m: path.basename(file),
        },
        bound: [min.x, min.y, min.z, max.x, max.y, max.z] as Entity['bound'],
        geom: chunks.append({
            faces: {
                positions: new Float32Array(verts),
                indices: new Uint32Array(faces),
                normals: new Float32Array(verts.length),
            },
            edges: {
                lines: Object.values(edges).map(([i, j]) => new Float32Array([
                    ...verts.slice(i * 3, i * 3 + 3),
                    ...verts.slice(j * 3, j * 3 + 3),
                ])),
            }
        })
    }] as Entity[]
}
