#!/usr/bin/env node

import path from 'path'
import { Command } from 'commander'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { step, mesh, Shape } from '@yff/ncc'
import { pack } from '../utils/data/pack'
import { Entity } from '../utils/data/entity'
import { sha256 } from '../utils/node/common'

const program = new Command()
program
.command('convert')
.arguments('<files...>')
.option('--save <path>')
.action(async (files: string[], { save = './commit.json' }) => {
async function saveSolid(solid: Shape, root: string, file: string) {
    const { faces, edges, geom } = mesh.topo(solid),
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

    return {
        data: data,
        bound: [min.x, min.y, min.z, max.x, max.y, max.z],
        attrs: {
            $n: path.basename(file) + '/' + data
        },
        geom: { url: hash + '/geom' },
        topo: {
            faces: { url: hash + '/faces' },
            edges: { url: hash + '/edges' }
        }
    } as Entity
}
try {
    for (const file of files) {
        if (file.toLowerCase().endsWith('.stp')) {
            const dir = path.dirname(save),
                shapes = step.load(file),
                entities = [ ] as Entity[]
            for (const solid of shapes.find(Shape.types.SOLID)) {
                entities.push(await saveSolid(solid, dir, file))
            }
            await writeFile(save, JSON.stringify({ entities }))
        } else {
            throw Error(`parsing file ${file} not supported`)
        }
    }
} catch (err) {
    console.error(err)
    process.exit(-1)
}
})

program.on('command:*', () => {
    program.outputHelp()
    process.exit(1)
})

program.parse(process.argv)
