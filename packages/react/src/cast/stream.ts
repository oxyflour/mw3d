import cp, { spawn } from 'child_process'
import os from 'os'
import path from 'path'
import WebSocket, { Server } from 'ws'
import { Server as HttpServer } from 'http'
import { mkdir, rm } from 'fs/promises'

const procs = { } as Record<string, cp.ChildProcessWithoutNullStreams>
export async function fork(href: string, channel: string) {
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
    procs[pid] = proc
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
            procs[data.pid]?.kill()
        }
        for (const item of list.filter(item => item !== ws)) {
            item.send(buf)
        }
    })
    ws.on('close', () => {
        list.splice(list.indexOf(ws), 1)
    })
}

export function register(httpServer: HttpServer, prefix = '/pub-sub/') {
    const stream = new Server({ noServer: true })
    httpServer.on('upgrade', (req, res, head) => {
        if (req.url?.startsWith(prefix)) {
            const [channel = ''] = req.url.slice(prefix.length).split('?')
            stream.handleUpgrade(req, res as any, head, ws => accept(ws, channel))
        }
    })
}
