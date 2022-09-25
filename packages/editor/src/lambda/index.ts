import path from "path"
import os from 'os'
import { mkdir, readFile, writeFile, rm } from "fs/promises"

import store from "../utils/node/store"
import { Entity } from "../utils/data/entity"
import { fork } from "../utils/node/fork"
import { sha256 } from "../utils/node/common"

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

export default {
    assets: {
        async get(key: string) {
            return await store.get(key)
        },
    },
    async *open(files: File[]) {
        const cwd = path.join(os.tmpdir(), 'open', Math.random().toString(16).slice(2, 10))
        await mkdir(cwd, { recursive: true })
        const copy = async (src: string, dir: string) => {
            const buf = await readFile(path.join(cwd, src)),
                key = path.join(dir, src).replace(/\\/g, '/')
            return await store.set(key, buf)
        }
        for (const file of files) {
            yield { message: `opening ${file.name}` }
            await writeFile(path.join(cwd, file.name), Buffer.from(await file.arrayBuffer()))
            const save = path.join(cwd, file.name + '.commit.json'),
                command = [
                    process.execPath, SCRIPT_PATH,
                    'convert', path.join(cwd, file.name),
                    '--save', save,
                ].map(item => `"${item}"`).join(' ')
            yield { command }
            for await (const item of fork(command, [], { cwd })) {
                yield { ...item }
            }

            yield { message: `parsing ${file.name}` }
            const json = await readFile(save, 'utf-8'),
                { entities } = JSON.parse(json) as { entities: Entity[] }
            await Promise.all(entities.map(async ({ topo, geom, data }) => {
                // TODO: storage backend
                const hash = data ?
                    sha256(await readFile(path.join(cwd, data))) :
                    Math.random().toString(16).slice(2, 10)
                if (geom?.url) {
                    geom.url = await copy(geom.url, `geom/${hash}`)
                }
                if (topo?.faces?.url) {
                    topo.faces.url = await copy(topo.faces.url, `topo/faces/${hash}`)
                }
                if (topo?.edges?.url) {
                    topo.edges.url = await copy(topo.edges.url, `topo/edges/${hash}`)
                }
            }))
            yield { entities }
        }
        await rm(cwd, { recursive: true, force: true })
    },
}
