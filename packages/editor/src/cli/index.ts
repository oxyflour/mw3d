#!/usr/bin/env node

import { Command } from 'commander'
import { writeFile } from 'fs/promises'
import { parse } from './shape/occ'

const program = new Command()

program
.command('convert')
.arguments('<files...>')
.option('--save <path>')
.action(async (files: string[], { save = './commit.json' }) => {
try {
    for (const file of files) {
        if (file.toLowerCase().endsWith('.stp')) {
            const entities = await parse(file, save)
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
