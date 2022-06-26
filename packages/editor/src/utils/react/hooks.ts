import { DependencyList, useEffect, useState } from "react"

const savedIntCacne = { } as Record<string, number>
export function useSavedInt(key: string, init: number) {
    const saved = key in savedIntCacne ? savedIntCacne[key]! :
            (savedIntCacne[key] = parseInt(localStorage.getItem(key) || init + '')),
        ret = useState(saved),
        [val] = ret
    useEffect(() => localStorage.setItem(key, val + ''), [val])
    return ret
}

export function useAsync<D extends DependencyList, T>(func: (...args: D) => Promise<T>, deps: D, init?: T) {
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
