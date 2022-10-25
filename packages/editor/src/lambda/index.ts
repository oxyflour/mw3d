import os from 'os'
import path from 'path'
import { spawn } from "node:child_process"
import store from "../utils/node/store"
import { open } from './shape'

export default {
    sess: {
        async fork(sess: string, href: string) {
            spawn(path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome SxS\\Application\\chrome'), [
                `--app=${href}`,
                '--enable-unsafe-webgpu',
                '--auto-accept-this-tab-capture',
                `--auto-select-tab-capture-source-by-title=${sess}`,
                '--ignore-certificate-errors',
            ])
        },
        async *sub(sess: string) {
            const queue = [] as { error: any, result: string }[],
                callbacks = [] as { resolve: Function, reject: Function }[],
                unsub = await store.cache.sub(sess, ({ error, result }) => {
                    const cb = callbacks.shift()
                    if (cb) {
                        error ? cb.reject(error) : cb.resolve(result)
                    } else {
                        queue.push({ error, result })
                    }
                })
            try {
                let item
                while (true) {
                    while (item = queue.shift()) {
                        const { error, result } = item
                        if (error) {
                            throw Object.assign(new Error(), error)
                        } else {
                            yield result
                        }
                    }
                    yield await new Promise<string>((resolve, reject) => callbacks.push({ resolve, reject }))
                }
            } catch (error) {
                await unsub()
                throw error
            }
        },
        async pub(sess: string, result: string) {
            await store.cache.pub(sess, { result })
        },
        async stop(sess: string) {
            await store.cache.pub(sess, { error: { message: `session ${sess} stop` } })
        },
    },
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
