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
.option('--save')
.action(async (files: string[], { save = './commit.json' }) => {
try {
    for (const file of files) {
        if (file.toLowerCase().endsWith('.stp')) {
            const dir = path.dirname(save),
                shape = step.load(file),
                faces = mesh.create(shape),
                { min, max } = shape.bound()
            await mkdir(dir, { recursive: true })
            await writeFile(path.join(dir, 'data'), await readFile(file))
            await writeFile(path.join(dir, 'geom'), pack({ faces }))
            await writeFile(save, JSON.stringify({
                entities: [{
                    data: 'data',
                    geom: {
                        url: 'geom',
                        bound: [min.x, min.y, min.z, max.x, max.y, max.z],
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
