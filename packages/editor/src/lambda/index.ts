import os from 'os'
import path from 'path'
import WebSocket, { Server } from 'ws'
import { ChildProcessWithoutNullStreams, spawn } from "node:child_process"
import { mkdir, rm } from 'fs/promises'
import { Server as HttpServer } from 'http'

import store from "../utils/node/store"
import { open } from './shape'

const procs = { } as Record<string, ChildProcessWithoutNullStreams>
export async function fork(href: string, channel: string) {
    const sess = Math.random().toString(16).slice(2, 10),
        tmp = path.join(os.tmpdir(), 'ttk-cast', `${channel}-${sess}`),
        url = new URL(href)
    url.searchParams.set('channel', channel)
    url.searchParams.set('sess', sess)
    await mkdir(tmp, { recursive: true })
    const proc = spawn(path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome SxS\\Application\\chrome'), [
        `--app=${url.toString()}`,
        '--enable-unsafe-webgpu',
        '--auto-accept-this-tab-capture',
        `--auto-select-tab-capture-source-by-title=${channel}-${sess}`,
        '--ignore-certificate-errors',
        '--no-sandbox',
        `--user-data-dir=${tmp}`
    ])
    procs[sess] = proc
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
}

const sockets = { } as Record<string, WebSocket[]>
export function accept(ws: WebSocket, channel: string) {
    const list = sockets[channel] || (sockets[channel] = [])
    list.push(ws)
    ws.on('message', buf => {
        const { event, data } = JSON.parse(buf.toString())
        if (event === 'fork') {
            fork(data.href, data.channel)
        } else if (event === 'kill') {
            procs[data.sess]?.kill()
        }
        for (const item of list.filter(item => item !== ws)) {
            item.send(buf)
        }
    })
    ws.on('close', () => {
        list.splice(list.indexOf(ws), 1)
    })
}

export const hooks = {
    init(httpServer: HttpServer) {
        const stream = new Server({ noServer: true })
        httpServer?.on('upgrade', (req, res, head) => {
            if (req.url?.startsWith('/pub-sub/')) {
                const [channel = ''] = req.url.slice('/pub-sub/'.length).split('?')
                stream.handleUpgrade(req, res as any, head, ws => accept(ws, channel))
            }
        })
    }
}

export default {
    commit: store.commit,
    assets: {
        async get(key: string) {
            try {
                return await store.cache.get(key)
            } catch (err) {
                const [data = ''] = key.split('/g/'),
                    buf = await store.library.get(data),
                    head = buf.toString().slice(0, 100),
                    name = head.startsWith('ISO-10303-21') ? 'main.stp' : data,
                    file = { name, arrayBuffer: () => Promise.resolve(buf) }
                for await (const msg of open([file])) {
                    console.log(msg)
                }
                return await store.cache.get(key)
            }
        }
    },
    shape: { open }
}
