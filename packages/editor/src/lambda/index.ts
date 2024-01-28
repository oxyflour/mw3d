import type { Middleware } from 'koa'
import { Server as HttpServer } from 'http'

import store from "../utils/node/store"
import { open } from './shape'

export const koa = {
    middlewares: [async (ctx, next) => {
        if (ctx.req.url === '/healthz') {
            ctx.body = 'OK'
        } else if (ctx.req.url?.startsWith('/static/geom/')) {
            const key = ctx.req.url.slice('/static/geom/'.length)
            ctx.body = await assets.get(key)
        } else {
            await next()
        }
    }] as Middleware[]
}

export const hooks = {
    init(httpServer: HttpServer) {
        httpServer
        /*
        const source = Math.random().toString(16).slice(2, 10)
        store.cache.sub('broadcast', ({ channel, event, data, source: from }) => {
            if (from !== source) {
                for (const ws of sockets[channel] || []) {
                    ws.send(JSON.stringify({ event, data }))
                }
            }
        })
        const sockets = register(httpServer, (channel, event, data) => {
            if (event === 'fork') {
            } else if (event === 'kill') {
            } else {
                store.cache.pub('broadcast', { source, channel, event, data })
            }
        })
         */
    }
}

const assets = {
    async get(key: string) {
        try {
            return await store.cache.get(key)
        } catch (err) {
            const [name = ''] = key.split('/g/')
            for await (const msg of open([{ name }])) {
                msg
            }
            return await store.cache.get(key)
        }
    }
}

export default {
    commit: store.commit,
    assets,
    shape: { open }
}
