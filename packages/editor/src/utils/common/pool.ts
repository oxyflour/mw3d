export function pool<F extends (...args: any) => Promise<any>>(func: F) {
    let promise = Promise.resolve()
    return ((...args: any) => {
        return promise = promise
            .then(() => func(...args))
            .catch(err => { throw err })
    }) as any as F
}
