import { DependencyList, useEffect, useState } from "react"

export function useAsync<D extends DependencyList, T>(func: (...args: any[]) => Promise<T>, deps: D, init?: T) {
    const [loading, setLoading] = useState(false),
        [error, setError] = useState<any>(null),
        [value, setValue] = useState(init),
        ret = { loading, error, value },
        set = { setLoading, setError, setValue }
    useEffect(() => {
        setError(null)
        setLoading(true)
        func(...deps)
            .then(value => setValue(value))
            .catch(error => setError(error))
            .finally(() => setLoading(false))
    }, deps)
    return [ret, set] as [typeof ret, typeof set]
}

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
