import path from "path"
import os from 'os'
import { mkdir, readFile, writeFile, rm } from "fs/promises"

import store from "../../utils/node/store"
import { Entity } from "../../utils/data/entity"
import { fork } from "../../utils/node/fork"

const SCRIPT_PATH = path.join(__dirname, '..', '..', '..', 'dist', 'cli', 'index.js')
export async function *open(files: { name: string, arrayBuffer: () => Promise<ArrayBuffer> }[]) {
    const cwd = path.join(os.tmpdir(), 'open', Math.random().toString(16).slice(2, 10))
    await mkdir(cwd, { recursive: true })
    const read = (src: string) => readFile(path.join(cwd, src))
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
        await Promise.all(entities.map(async entity => {
            const { topo, geom, data } = entity
            if (data) {
                entity.data = await store.data.save(await read(data))
            }
            if (geom?.url) {
                geom.url = await store.geom.cache(await read(geom.url), entity.data || '')
            }
            if (topo?.faces?.url) {
                topo.faces.url = await store.geom.cache(await read(topo.faces.url), entity.data || '')
            }
            if (topo?.edges?.url) {
                topo.edges.url = await store.geom.cache(await read(topo.edges.url), entity.data || '')
            }
            if (topo?.verts?.url) {
                topo.verts.url = await store.geom.cache(await read(topo.verts.url), entity.data || '')
            }
        }))
        yield { entities }
    }
    await rm(cwd, { recursive: true, force: true })
}