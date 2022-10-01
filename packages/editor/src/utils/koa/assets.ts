import { IncomingMessage } from "http"
import store from "../node/store"

export default async (ctx: { req: IncomingMessage, body?: any }, next: Function) => {
    if (ctx.req.url === '/healthz') {
        ctx.body = 'OK'
    } else if (ctx.req.url?.startsWith('/static/geom/')) {
        ctx.body = await store.geom.get(ctx.req.url.slice('/static/geom/'.length))
    } else {
        await next()
    }
}
