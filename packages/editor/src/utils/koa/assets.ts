import { IncomingMessage } from "http"
import lambda from '../../lambda'

export default async (ctx: { req: IncomingMessage, body?: any }, next: Function) => {
    if (ctx.req.url === '/healthz') {
        ctx.body = 'OK'
    } else if (ctx.req.url?.startsWith('/static/assets/')) {
        ctx.body = await lambda.assets.get(ctx.req.url.slice('/static/assets/'.length))
    } else {
        await next()
    }
}
