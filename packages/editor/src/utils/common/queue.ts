export function queue<F extends (...args: any) => Promise<any>>(func: F) {
    let promise = Promise.resolve()
    return ((...args: any) => new Promise((resolve, reject) => {
        promise = promise.then(() => func(...args).then(resolve).catch(reject))
    })) as any as F
}
