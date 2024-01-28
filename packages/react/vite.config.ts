import cp, { spawn } from 'child_process'
import os from 'os'
import path from 'path'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import { mkdir, rm } from 'fs/promises'
import { defineConfig } from 'vite'
import { register } from './src/cast/stream'

export async function fork(channel: string, href: string) {
    const pid = Math.random().toString(16).slice(2, 10),
        tmp = path.join(os.tmpdir(), 'ttk-cast', `${channel}-${pid}`),
        url = new URL(href)
    url.searchParams.set('channel', channel)
    url.searchParams.set('pid', pid)
    await mkdir(tmp, { recursive: true })
    const proc = spawn(path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome SxS\\Application\\chrome'), [
        `--app=${url.toString()}`,
        '--enable-unsafe-webgpu',
        '--auto-accept-this-tab-capture',
        `--auto-select-tab-capture-source-by-title=${channel}-${pid}`,
        '--ignore-certificate-errors',
        '--no-sandbox',
        `--user-data-dir=${tmp}`
    ])
    proc.on('exit', async () => {
        let retry = 10
        while (retry --) {
            try {
                await rm(tmp, { recursive: true, force: true })
                break
            } catch (err) {
                await new Promise(resolve => setTimeout(resolve, 1000))
            }
        }
    })
    return { proc, pid }
}

const procs = { } as Record<string, cp.ChildProcessWithoutNullStreams>
export default defineConfig({
    plugins: [
        react(),
        {
            name: 'caster',
            configureServer({ httpServer }) {
                httpServer && register(httpServer, async (channel, event, data) => {
                    if (event === 'fork') {
                        const { proc, pid } = await fork(channel, data.href)
                        procs[pid] = proc
                    } else if (event === 'kill') {
                        procs[data.pid]?.kill()
                    }
                })
            }
        }],
    server: {
    },
    build: {
        sourcemap: true,
        lib: {
            entry: './src',
            name: 'react',
            formats: ['es']
        },
        rollupOptions: {
            external: ['react', 'three'],
            output: {
                globals: {
                    react: 'react',
                    three: 'three',
                }
            }
        }
    },
})
