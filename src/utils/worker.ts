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
    if (globalThis.WorkerGlobalScope) {
        onmessage = async msg => {
            const { id, entry, args } = msg.data as { id: string, entry: string[], args: any[] },
                [func, obj] = entry.reduce(([api], key) => [api?.[key], api], [api as any, null])
            if (func) {
                try {
                    const ret = recv ?
                            await recv(args, () => func.apply(obj, args)) :
                            await func.apply(obj, args),
                        transfer = ret instanceof ArrayBuffer ? [ret] : []
                    postMessage({ id, ret }, { transfer })
                } catch (err) {
                    postMessage({ id, err })
                }
            } else {
                const err = new Error(`no function at ${entry.join('.')}`)
                postMessage({ id, err })
            }
        }
    } else {
        for (let i = 0; i < num; i ++) {
            const worker = fork()
            worker.addEventListener('message', msg => {
                const { id, err, ret } = msg.data,
                    call = calls[id]
                if (call) {
                    err ? call.reject(err) : call.resolve(ret)
                    delete calls[id]
                }
            })
            workers.push(worker)
        }
    }
    return hookFunc(api, (...stack) => {
        const entry = stack.map(item => item.propKey).reverse()
        return (...args: any[]) => {
            const selected = workers[Math.floor(Math.random() * workers.length)],
                id = Math.random().toString(16).slice(2, 10)
            if (send) {
                return send(args, (args, transfer) => {
                    selected.postMessage({ id, entry, args }, transfer)
                    return new Promise((resolve, reject) => calls[id] = { resolve, reject })
                })
            } else {
                selected.postMessage({ id, entry, args })
                return new Promise((resolve, reject) => calls[id] = { resolve, reject })
            }
        }
    })
}
