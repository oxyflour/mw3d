import { defineConfig } from 'vite'

const workerParsed = { } as Record<string, { code: string, map: any }>
export default defineConfig({
    worker: {
        plugins: [{
            name: 'avoid infinite import',
            transform(code, id) {
                return workerParsed[id] ? 'export default { }' : (workerParsed[id] = { code, map: null })
            }
        }]
    },
})
