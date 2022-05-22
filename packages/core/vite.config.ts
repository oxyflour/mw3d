import { defineConfig } from 'vite'
import plugin from './src/tool/vite'

export default defineConfig({
    plugins: [plugin],
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
