import path from "path"
import os from 'os'
import { mkdir, readFile, writeFile, rm } from "fs/promises"

import store from "../../utils/node/store"
import { BufferData, Entity } from "../../utils/data/entity"
import { fork } from "../../utils/node/fork"

const SCRIPT_PATH = path.join(__dirname, '..', '..', '..', 'dist', 'cli', 'index.js')
export async function *open(files: { name: string, arrayBuffer: () => Promise<ArrayBuffer> }[]) {
    const cwd = path.join(os.tmpdir(), 'open', Math.random().toString(16).slice(2, 10))
    for (const file of files) {
        yield { message: `opening ${file.name}` }
        const tmp = path.join(cwd, file.name)
        await mkdir(path.dirname(tmp), { recursive: true })
        await writeFile(tmp, Buffer.from(await file.arrayBuffer()))
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
            { entities } = JSON.parse(json) as { entities: Entity[] },
            bufs = await readFile(save + '.data'),
            slice = (chunk: BufferData) => bufs.slice(chunk.offset || 0, chunk.offset! + chunk.size!)
        await Promise.all(entities.map(async entity => {
            const { topo, geom, data } = entity
            if (data) {
                entity.data = { url: await store.library.save(slice(data), 'data/') }
            }
            if (geom) {
                entity.geom = { url: await store.geom.cache(slice(geom), entity.data?.url || '') }
            }
            if (topo?.faces) {
                topo.faces = { url: await store.geom.cache(slice(topo.faces), entity.data?.url || '') }
            }
            if (topo?.edges) {
                topo.edges = { url: await store.geom.cache(slice(topo.edges), entity.data?.url || '') }
            }
            if (topo?.verts) {
                topo.verts = { url: await store.geom.cache(slice(topo.verts), entity.data?.url || '') }
            }
        }))
        yield { entities }
    }
    await rm(cwd, { recursive: true, force: true })
}
