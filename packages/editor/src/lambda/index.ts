import path from "path"
import { mkdir, readFile, cp, writeFile } from "fs/promises"
import { Entity } from "../utils/data/entity"
import { fork } from "../utils/node/fork"
import { sha256 } from "../utils/node/common"

const DIST_PATH = path.join(__dirname, '..', '..', 'dist'),
    SCRIPT_PATH = path.join(DIST_PATH, 'cli', 'index.js'),
    ASSETS_PATH = path.join(DIST_PATH, 'assets')

async function copyToAssets(src: string, dst: string) {
    const tmp = path.join(ASSETS_PATH, dst)
    await mkdir(path.dirname(tmp), { recursive: true })
    await cp(src, tmp)
    return dst
}

export default {
    assets: {
        async get(url: string) {
            return readFile(path.join(ASSETS_PATH, url))
        },
    },
    async *open(files: File[]) {
        const cwd = path.join(process.cwd(), 'tmp')
        await mkdir(cwd, { recursive: true })
        const copy = (src: string, dir: string) => copyToAssets(path.join(cwd, src), path.join(dir, src))
        for (const file of files) {
            await writeFile(path.join(cwd, file.name), Buffer.from(await file.arrayBuffer()))
            const output = path.join(cwd, file.name + '.commit.json'),
                command = [
                    process.execPath,
                    SCRIPT_PATH,
                    'convert',
                    path.join(cwd, file.name),
                    '--save',
                    output,
                ].map(item => `"${item}"`).join(' ')
            yield { message: `parsing ${file.name}` }
            yield { command }
            for await (const item of fork(command, [], { cwd })) {
                yield { ...item }
            }
            const json = await readFile(output, 'utf-8'),
                { entities } = JSON.parse(json) as { entities: Entity[] }
            for (const { geom, topo, data } of entities) {
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
            }
            yield { entities }
        }
    },
}
