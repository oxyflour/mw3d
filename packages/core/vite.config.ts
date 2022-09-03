import { defineConfig } from 'vite'
import plugin from './src/tool/vite'

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
            name: 'umd'
        }
    },
    server: {
        fs: { strict: false }
    }
})
