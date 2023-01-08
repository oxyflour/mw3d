import WebSocket, { Server } from 'ws'
import { Server as HttpServer } from 'http'

export type Callback = (channel: string, event: string, data: any) => void

const sockets = { } as Record<string, WebSocket[]>
export function accept(ws: WebSocket, channel: string, callback?: Callback) {
    const list = sockets[channel] || (sockets[channel] = [])
    list.push(ws)
    ws.on('message', buf => {
        const { event, data } = JSON.parse(buf.toString())
        callback?.(channel, event, data)
        for (const item of list.filter(item => item !== ws)) {
            item.send(buf)
        }
    })
    ws.on('close', () => {
        list.splice(list.indexOf(ws), 1)
    })
}

export function register(httpServer: HttpServer, callback?: Callback, prefix = '/pub-sub/') {
    const stream = new Server({ noServer: true })
    httpServer.on('upgrade', (req, res, head) => {
        if (req.url?.startsWith(prefix)) {
            const [channel = ''] = req.url.slice(prefix.length).split('?')
            stream.handleUpgrade(req, res as any, head, ws => accept(ws, channel, callback))
        }
    })
    return sockets
}
