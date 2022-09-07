import path from "path"
import { mkdir, readFile, rename, writeFile } from "fs/promises"
import { Entity } from "../utils/data/entity"
import { fork } from "../utils/node/fork"

const DIST_PATH = path.join(__dirname, '..', '..', 'dist'),
    SCRIPT_PATH = path.join(DIST_PATH, 'cli', 'index.js'),
    ASSETS_PATH = path.join(DIST_PATH, 'assets')

export default {
    geom: {
        async get(url: string) {
            return readFile(path.join(ASSETS_PATH, url))
        },
    },
    async *open(files: File[]) {
        const cwd = path.join(process.cwd(), 'tmp')
        await mkdir(cwd, { recursive: true })
        for (const file of files) {
            await writeFile(path.join(cwd, file.name), Buffer.from(await file.arrayBuffer()))
            const command = [
                process.execPath,
                SCRIPT_PATH,
                'convert',
                path.join(cwd, file.name)
            ].map(item => `"${item}"`).join(' ')
            yield { message: `parsing ${file.name}` }
            yield { command }
            for await (const item of fork(command, [], { cwd })) {
                yield { ...item }
            }
            const json = await readFile(path.join(cwd, 'commit.json'), 'utf-8'),
                { entities } = JSON.parse(json) as { entities: Entity[] }
            for (const entity of entities) {
                if (entity.geom?.url) {
                    const tmp = path.join(ASSETS_PATH, entity.geom.url)
                    await mkdir(path.dirname(tmp), { recursive: true })
                    await rename(path.join(cwd, entity.geom.url), tmp)
                }
            }
            yield { entities }
        }
    },
}
