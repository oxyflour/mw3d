import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { register } from './src/cast/stream'

export default defineConfig({
    plugins: [
        react(),
        {
            name: 'caster',
            configureServer({ httpServer }) {
                httpServer && register(httpServer)
            }
        }],
    server: {
    },
    build: {
        sourcemap: true,
        lib: {
            entry: './src',
            name: 'react'
        },
        rollupOptions: {
            external: ['react'],
            output: {
                globals: {
                    react: 'react'
                }
            }
        }
    },
})
