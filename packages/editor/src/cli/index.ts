#!/usr/bin/env node

import { Command } from 'commander'
import { writeFile } from 'fs/promises'
import { Entity } from '../utils/data/entity'
import { Chunks } from '../utils/node/chunks'
import { parse } from './shape/occ'

const program = new Command()

program
.command('convert')
.arguments('<files...>')
.option('--save <path>')
.action(async (files: string[], { save = './commit.json' }) => {
try {
    const chunks = new Chunks(),
        entities = [] as Entity[]
    for (const file of files) {
        if (file.toLowerCase().endsWith('.stp')) {
            entities.push(...await parse(chunks, file))
        } else {
            throw Error(`parsing file ${file} not supported`)
        }
    }
    await writeFile(save, JSON.stringify({ entities }))
    await chunks.write(save + '.data')
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
