export function asyncCache<F extends (...args: any) => Promise<any>>(func: F) {
    const cache = { } as Record<string, Promise<any>>
    return ((...args: any[]) => {
        const key = JSON.stringify(args)
        if (cache[key]) {
            return cache[key]
        } else {
            const promise = (cache[key] = func(...args))
            promise.catch(() => { delete cache[key] })
            return promise
        }
    }) as any as F
}
