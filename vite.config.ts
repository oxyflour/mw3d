import { defineConfig } from 'vite'
import plugin from './src/tool/vite'

export default defineConfig({
    plugins: [plugin],
    build: { sourcemap: true },
    server: {
        fs: { strict: false }
    }
});
