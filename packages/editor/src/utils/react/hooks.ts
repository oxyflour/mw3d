import { DependencyList, useEffect, useState } from "react"

const localStoreCache = { } as Record<string, any>
export function useLocalStore<T>(key: string, init: T) {
    const saved = key in localStoreCache ? localStoreCache[key]! as T :
            (localStoreCache[key] = JSON.parse(localStorage.getItem(key) || init + '')) as T,
        ret = useState(saved),
        [val] = ret
    useEffect(() => localStorage.setItem(key, JSON.stringify(val)), [val])
    return ret
}

export function useAsync<D extends DependencyList, T>(func: (...args: any) => Promise<T>, deps: D, init?: T) {
    const [loading, setLoading] = useState(false),
        [error, setError] = useState(null),
        [value, setValue] = useState(init),
        ret = { loading, error, value }
    useEffect(() => {
        setError(null)
        setLoading(true)
        func(...deps)
            .then(value => setValue(value))
            .catch(error => setError(error))
            .finally(() => setLoading(false))
    }, deps)
    return [ret] as [typeof ret]
}
