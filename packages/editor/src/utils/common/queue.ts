export function queue<F extends (...args: any) => Promise<any>>(func: F) {
    let promise: undefined | Promise<any>
    return ((...args: any) => {
        return promise || (promise = func(...args)
            .finally(() => promise = undefined))
    }) as any as F
}
