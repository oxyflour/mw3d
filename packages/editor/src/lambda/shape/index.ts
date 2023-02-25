import path from "path"
import os from 'os'
import { mkdir, readFile, writeFile, rm } from "fs/promises"

import store from "../../utils/node/store"
import { Entity } from "../../utils/data/entity"
import { fork } from "../../utils/node/fork"
import { Chunks } from "../../utils/node/chunks"
import worker from "../../utils/node/worker"

const SCRIPT_PATH = path.join(__dirname, '..', '..', '..', 'dist', 'cli', 'index.js')
export async function *open(files: { name: string, arrayBuffer?: () => Promise<ArrayBuffer> }[]) {
    const cwd = path.join(os.tmpdir(), 'open', Math.random().toString(16).slice(2, 10))
    for (const { name, arrayBuffer } of files) {
        yield { message: `opening ${name}` }
        const tmp = path.join(cwd, name),
            ext = name.split('.').pop() || '',
            buf = arrayBuffer ? Buffer.from(await arrayBuffer()) : await store.library.get(name)
        await mkdir(path.dirname(tmp), { recursive: true })
        await writeFile(tmp, buf)
        const save = path.join(cwd, name + '.commit.json'),
            command = [
                process.execPath, SCRIPT_PATH,
                'convert', tmp,
                '--save', save,
            ].map(item => `"${item}"`).join(' ')
        yield { command }
        for await (const item of fork(command, [], { cwd })) {
            yield { ...item }
        }

        yield { message: `parsing ${name}` }
        async function saveBuffer(buf: Buffer) {
            const hash = await worker.sha256(new Uint8Array(buf)),
                url = 'd/' + hash + '.' + ext
            return await store.library.set(url, buf)
        }
        const json = await readFile(save, 'utf-8'),
            { entities } = JSON.parse(json) as { entities: Entity[] },
            chunks = await Chunks.read(save + '.data'),
            cache = { } as { hash?: Promise<string> },
            tasks = entities.map(async (entity, idx) => {
                const { topo, geom, data } = entity
                if (data) {
                    entity.data = { url: await saveBuffer(chunks.slice(data)) }
                } else {
                    const save = cache.hash || (cache.hash = saveBuffer(buf))
                    entity.data = { url: await save, idx }
                }
                const dataUrl = entity.data?.url || Math.random().toString(16).slice(2, 10)
                if (geom) {
                    entity.geom = { url: await store.cache.set(dataUrl + '/g/geom', chunks.slice(geom)) }
                }
                if (topo?.faces) {
                    topo.faces = { url: await store.cache.set(dataUrl + '/g/topo/faces', chunks.slice(topo.faces)) }
                }
                if (topo?.edges) {
                    topo.edges = { url: await store.cache.set(dataUrl + '/g/topo/edges', chunks.slice(topo.edges)) }
                }
                if (topo?.verts) {
                    topo.verts = { url: await store.cache.set(dataUrl + '/g/topo/verts', chunks.slice(topo.verts)) }
                }
            })
        for (const [idx, task] of tasks.entries()) {
            await task
            yield { message: `parsing ${name} (${idx + 1}/${tasks.length})` }
        }
        yield { entities }
    }
    await rm(cwd, { recursive: true, force: true })
}
