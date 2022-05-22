import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
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
