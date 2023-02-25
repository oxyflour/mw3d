import { Worker, isMainThread, parentPort, threadId } from "worker_threads"
import { pack, unpack } from "../common/pack"

export type AsyncFunction<T> = (...args: any[]) => Promise<T>
export type AsyncIteratorFunction<T> = (...args: any[]) => AsyncIterableIterator<T>
export interface ApiDefinition { [name: string]: string | AsyncIteratorFunction<any> | AsyncFunction<any> | ApiDefinition }

export interface ProxyStackItem {
    target: any,
    propKey: any,
    receiver: any,
}

export function hookFunc<M extends ApiDefinition>(
        methods: M,
        proxy: (...stack: ProxyStackItem[]) => any,
        stack = [ ] as ProxyStackItem[]): M {
    return new Proxy(methods, {
        get(target, propKey, receiver) {
            const next = [{ target, propKey, receiver }].concat(stack)
            return hookFunc(proxy(...next) as ApiDefinition, proxy, next)
        }
    })
}

export default function wrap<T extends ApiDefinition>({ num, api, fork, send, recv }: {
    api: T
    fork: () => Worker
    num: number
    send?: (args: any[], next: (args: any[], transfer: any[]) => Promise<any>) => Promise<any>
    recv?: (args: any[], next: (args: any[]) => Promise<any>) => Promise<any>
}) {
    const workers = [] as Worker[],
        calls = { } as Record<string, { resolve: Function, reject: Function }>
    if (!isMainThread) {
        console.log(`[WORKER ${threadId}] starting`)
        parentPort?.addListener('message', async data => {
            const { id, entry, args } = unpack(data) as { id: string, entry: string[], args: any[] },
                [func, obj] = entry.reduce(([api], key) => [api?.[key], api], [api as any, null])
            if (func) {
                try {
                    const ret = recv ?
                            await recv(args, () => func.apply(obj, args)) :
                            await func.apply(obj, args),
                        data = pack({ id, ret })
                    parentPort?.postMessage(data, [data.buffer])
                } catch (err: any) {
                    const { message, stack } = err,
                        data = pack({ id, err: { ...err, message, stack } })
                    parentPort?.postMessage(data, [data.buffer])
                }
            } else {
                const err = new Error(`no function at ${entry.join('.')}`),
                    data = pack({ id, err })
                parentPort?.postMessage(data, [data.buffer])
            }
        })
        console.log(`[WORKER ${threadId}] started`)
    } else {
        function start(idx: number) {
            const worker = fork()
            worker.addListener('message', msg => {
                const { id, err, ret } = unpack(msg) as any,
                    call = calls[id]
                if (call) {
                    err ? call.reject(err) : call.resolve(ret)
                    delete calls[id]
                }
            })
            worker.addListener('exit', () => {
                workers[idx] = start(idx)
            })
            worker.stdout?.pipe(process.stdout)
            worker.stderr?.pipe(process.stderr)
            return worker
        }
        for (let idx = 0; idx < num; idx ++) {
            workers.push(start(idx))
        }
    }
    return hookFunc(api, (...stack) => {
        const entry = stack.map(item => item.propKey).reverse()
        return (...args: any[]) => {
            const selected = workers[Math.floor(Math.random() * workers.length)],
                id = Math.random().toString(16).slice(2, 10)
            if (!selected) {
                throw Error(`no worker candicate`)
            }
            if (send) {
                return send(args, args => {
                    const data = pack({ id, entry, args })
                    selected.postMessage(data, [data.buffer])
                    return new Promise((resolve, reject) => calls[id] = { resolve, reject })
                })
            } else {
                const data = pack({ id, entry, args })
                selected.postMessage(data, [data.buffer])
                return new Promise((resolve, reject) => calls[id] = { resolve, reject })
            }
        }
    })
}
