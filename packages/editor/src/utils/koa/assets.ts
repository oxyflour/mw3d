import { IncomingMessage } from "http"
import store from "../node/store"
import lambda from "../../lambda"

export default async (ctx: { req: IncomingMessage, body?: any }, next: Function) => {
    if (ctx.req.url === '/healthz') {
        ctx.body = 'OK'
    } else if (ctx.req.url?.startsWith('/static/geom/')) {
        const key = ctx.req.url.slice('/static/geom/'.length)
        try {
            ctx.body = await store.root.get(key)
        } catch (err) {
            const [data = ''] = key.split('/g/'),
                buf = await store.root.get(data),
                file = { name: data, arrayBuffer: () => Promise.resolve(buf) }
            for await (const msg of lambda.shape.open([file])) {
                console.log(msg)
            }
            ctx.body = await store.root.get(key)
        }
    } else {
        await next()
    }
}
