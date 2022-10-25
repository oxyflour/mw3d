import { IncomingMessage } from "http"
import lambda from "../../lambda"

export default async (ctx: { req: IncomingMessage, body?: any }, next: Function) => {
    if (ctx.req.url === '/healthz') {
        ctx.body = 'OK'
    } else if (ctx.req.url?.startsWith('/static/geom/')) {
        const key = ctx.req.url.slice('/static/geom/'.length)
        ctx.body = await lambda.assets.get(key)
    } else {
        await next()
    }
}
