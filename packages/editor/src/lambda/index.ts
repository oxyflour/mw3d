import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { fork } from "../utils/node/fork"

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'dist', 'cli', 'index.js')

export default {
    async *open(files: File[]) {
        for (const file of files) {
            const cwd = path.join(process.cwd(), 'tmp')
            await mkdir(cwd, { recursive: true })
            await writeFile(path.join(cwd, file.name), new Uint8Array(await file.arrayBuffer()))
            const cmd = [process.execPath, SCRIPT_PATH, 'convert', path.join(cwd, file.name)].map(item => `"${item}"`).join(' ')
            yield { message: `parsing ${file.name} (${cmd})` }
            for await (const msg of fork(cmd, [], { cwd })) {
                yield msg
            }
        }
    },
}
