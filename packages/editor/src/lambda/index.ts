import store from "../utils/node/store"
import { open } from './shape'

export default {
    sess: {
        async *sub(sess: string) {
            const queue = [] as { error: any, result: string }[],
                callbacks = [] as { resolve: Function, reject: Function }[],
                unsub = await store.root.sub(sess, ({ error, result }) => {
                    const cb = callbacks.shift()
                    cb ? (error ? cb.reject(error) : cb.resolve(result)) : queue.push({ error, result })
                })
            try {
                while (true) {
                    yield await new Promise<string>((resolve, reject) => callbacks.push({ resolve, reject }))
                    for (const { error, result } of queue) {
                        if (error) {
                            throw Error(error)
                        } else {
                            yield result
                        }
                    }
                    queue.length = 0
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
            await store.root.pub(sess, { error: { message: 'stopped' } })
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
