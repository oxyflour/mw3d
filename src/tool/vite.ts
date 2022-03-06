import cp from 'child_process'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { PluginOption, WebSocketServer } from "vite"

const suffix = '.as.ts',
    cached = { } as Record<string, string>
async function compile(file: string, url: string, ws?: WebSocketServer) {
    const [out] = url.split('?'),
        cmd = `npx asc "${file}" --sourceMap --exportRuntime -b ${out}`
    try {
        console.log(`EXEC: ${cmd}`)
        await promisify(cp.exec)(cmd)
        ws.send({ type: 'full-reload' })
    } catch (err) {
        console.error(err.stderr)
    }
}

let timeout = Promise.resolve()
export default {
    name: 'assembly-loader',
    enforce: 'pre',
    configureServer({ ws, watcher }) {
        watcher.on('change', file => {
            if (file.endsWith(suffix)) {
                timeout = timeout.then(() => compile(file, cached[file], ws))
            }
        })
    },
    async resolveId(src: string, importee: string) {
        if (src.endsWith(suffix)) {
            const file = path.join(path.dirname(importee), src)
            if (!cached[file]) {
                this.addWatchFile(file)
                const tmp = path.join(os.tmpdir(),
                    `assembly-${Object.keys(cached).length}.wasm?url`)
                await compile(file, cached[file] = tmp)
            }
            return cached[file]
        }
        return null
    },
} as PluginOption
