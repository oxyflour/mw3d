import cp from 'child_process'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { PluginOption } from "vite"

const suffix = '.as.ts',
    cached = { } as Record<string, string>
async function compile(file: string, out: string) {
    console.log(`compiling ${file} ${out}`)
    await promisify(cp.exec)(`npx asc "${file}" -b ${out}`)
}
let timeout = Promise.resolve()
export default {
    name: 'assembly-loader',
    enforce: 'pre',
    configureServer({ ws, watcher }) {
        watcher.on('change', file => {
            if (file.endsWith(suffix)) {
                timeout = timeout.then(async () => {
                    await compile(file, cached[file])
                    ws.send({ type: 'full-reload' })
                })
            }
        })
    },
    async resolveId(src: string, importee: string) {
        if (src.endsWith(suffix)) {
            const file = path.join(path.dirname(importee), src)
            if (!cached[file]) {
                this.addWatchFile(file)
                await compile(file, cached[file] =
                    path.join(os.tmpdir(), `assembly-${Object.keys(cached).length}.wasm`))
            }
            return cached[file]
        }
        return null
    },
} as PluginOption
