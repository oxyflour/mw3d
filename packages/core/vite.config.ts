import { defineConfig } from 'vite'
import plugin from './src/tool/vite'
import fs from 'fs'
import path from 'path'

const webRtxDist = path.join(__dirname, '..', '..', 'node_modules', 'webrtx', 'dist'),
    targetDist = path.join(__dirname, 'src', 'example')
for (const item of fs.readdirSync(webRtxDist)) {
    if (item.endsWith('.module.wasm')) {
        if (!fs.existsSync(path.join(targetDist, item))) {
            fs.copyFileSync(path.join(webRtxDist, item), path.join(targetDist, item))
        }
    }
}

const workerParsed = { } as Record<string, { code: string, map: any }>
export default defineConfig({
    plugins: [plugin],
    worker: {
        plugins: [{
            name: 'avoid infinite import',
            transform(code, id) {
                return workerParsed[id] ? 'export default { }' : (workerParsed[id] = { code, map: null })
            }
        }]
    },
    build: {
        sourcemap: true,
        lib: {
            entry: './src',
            name: 'core',
            formats: ['es']
        },
        rollupOptions: {
            external: ['three', 'webrtx'],
            output: {
                globals: {
                    three: 'three',
                    webrtx: 'webrtx'
                }
            }
        }
    },
    server: {
        fs: { strict: false }
    }
})
