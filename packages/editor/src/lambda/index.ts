import path from "path"
import crypto from 'crypto'
import { mkdir, readFile, cp, writeFile } from "fs/promises"
import { Entity } from "../utils/data/entity"
import { fork } from "../utils/node/fork"

const DIST_PATH = path.join(__dirname, '..', '..', 'dist'),
    SCRIPT_PATH = path.join(DIST_PATH, 'cli', 'index.js'),
    ASSETS_PATH = path.join(DIST_PATH, 'assets')

function sha256(buf: Buffer | string) {
    return crypto.createHash('sha256').update(buf).digest('hex')
}

export default {
    geom: {
        async get(url: string) {
            return readFile(path.join(ASSETS_PATH, 'geom', url))
        },
    },
    async *open(files: File[]) {
        const cwd = path.join(process.cwd(), 'tmp')
        await mkdir(cwd, { recursive: true })
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
                hash = sha256(json),
                { entities } = JSON.parse(json) as { entities: Entity[] }
            for (const entity of entities) {
                if (entity.geom?.url) {
                    const tmp = path.join(ASSETS_PATH, 'geom', hash, entity.geom.url)
                    await mkdir(path.dirname(tmp), { recursive: true })
                    await cp(path.join(cwd, entity.geom.url), tmp)
                    entity.geom.url = hash + '/' + entity.geom.url
                }
            }
            yield { entities }
        }
    },
}
