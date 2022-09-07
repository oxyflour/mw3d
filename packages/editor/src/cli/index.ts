#!/usr/bin/env node

import path from 'path'
import program from 'commander'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { step, mesh } from '@yff/ncc'
import { pack } from '../utils/data/pack'
import { Entity } from '../utils/data/entity'

program
.command('convert')
.arguments('<files...>')
.option('--save')
.action(async (files: string[], { save = './entity.json' }) => {
try {
    for (const file of files) {
        if (file.toLowerCase().endsWith('.stp')) {
            const shape = step.load(file),
                ret = mesh.create(shape),
                dir = path.dirname(save),
                { min, max } = shape.bound()
            await mkdir(dir, { recursive: true })
            await writeFile(path.join(dir, 'data'), await readFile(file))
            await writeFile(path.join(dir, 'geom'), pack(ret))
            await writeFile(save, JSON.stringify({
                entities: [{
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
