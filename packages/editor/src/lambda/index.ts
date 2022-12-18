import { Server as HttpServer } from 'http'
import { register } from '@ttk/react/dist/cast/stream'

import store from "../utils/node/store"
import { open } from './shape'

export const hooks = {
    init(httpServer: HttpServer) {
        register(httpServer)
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
