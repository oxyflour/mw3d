export function debounce<F extends (...args: any) => Promise<any>>(func: F, delay: number) {
    let timeout = null as any
    const queue = [] as { resolve: Function, reject: Function }[]
    return ((...args: any) => {
        if (timeout) {
            clearTimeout(timeout)
        }
        timeout = setTimeout(() => {
            timeout = null
            func(...args).then(ret => {
                queue.forEach(({ resolve }) => resolve(ret))
            }).catch(err => {
                queue.forEach(({ reject }) => reject(err))
            }).finally(() => {
                queue.length = 0
            })
        }, delay)
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
    }) as any as F
}
