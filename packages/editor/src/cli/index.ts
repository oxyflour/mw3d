#!/usr/bin/env node

import path from 'path'
import { Command } from 'commander'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { step, mesh } from '@yff/ncc'
import { pack } from '../utils/data/pack'
import { Entity } from '../utils/data/entity'

const program = new Command()
program
.command('convert')
.arguments('<files...>')
.option('--save <path>')
.action(async (files: string[], { save = './commit.json' }) => {
try {
    for (const file of files) {
        if (file.toLowerCase().endsWith('.stp')) {
            const dir = path.dirname(save),
                shape = step.load(file),
                { faces, edges, geom } = mesh.topo(shape),
                { min, max } = shape.bound()
            await mkdir(dir, { recursive: true })
            await writeFile(path.join(dir, 'data'), await readFile(file))
            await writeFile(path.join(dir, 'geom'), pack({
                faces: geom,
                edges: { lines: edges.map(item => item.positions) }
            }))
            await writeFile(path.join(dir, 'faces'), pack(faces))
            await writeFile(path.join(dir, 'edges'), pack(edges))
            await writeFile(save, JSON.stringify({
                entities: [{
                    data: 'data',
                    bound: [min.x, min.y, min.z, max.x, max.y, max.z],
                    attrs: {
                        $n: path.basename(file)
                    },
                    geom: { url: 'geom' },
                    topo: {
                        faces: { url: 'faces' },
                        edges: { url: 'edges' }
                    }
                } as Entity]
            }))
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
