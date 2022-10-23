import { spawn } from "node:child_process"
import store from "../utils/node/store"
import { open } from './shape'

export default {
    sess: {
        async fork(sess: string) {
            spawn('C:\\Users\\oxyfl\\AppData\\Local\\Google\\Chrome SxS\\Application\\chrome', [
                `--app=http://localhost:3000/sess/${sess}`,
                '--enable-unsafe-webgpu',
                '--auto-accept-this-tab-capture',
                `--auto-select-tab-capture-source-by-title=${sess}`
            ])
        },
        async *sub(sess: string) {
            const queue = [] as { error: any, result: string }[],
                callbacks = [] as { resolve: Function, reject: Function }[],
                unsub = await store.root.sub(sess, ({ error, result }) => {
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
            await store.root.pub(sess, { result })
        },
        async stop(sess: string) {
            await store.root.pub(sess, { error: { message: `session ${sess} stop` } })
        },
    },
    assets: {
        async get(key: string) {
            return await store.root.get(key)
        }
    },
    shape: {
        open
    }
}
