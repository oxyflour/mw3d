import { DependencyList, useEffect, useState } from "react"

export function useAsync<F extends (...args: any) => Promise<T>, T>(
    func: F, init: T, deps: DependencyList) {
    const [value, setValue] = useState(init),
        [loading, setLoading] = useState(false),
        [error, setError] = useState(null)
    async function load(state: { canceled: boolean }) {
        try {
            setLoading(true)
            setError(null)
            const value = await func(...deps)
            if (!state.canceled) {
                setValue(value)
                setLoading(false)
            }
        } catch (err: any) {
            if (!state.canceled) {
                setError(err)
                setLoading(false)
            }
        }
    }
    useEffect(() => {
        const state = { canceled: false }
        load(state)
        return () => { state.canceled = true }
    }, deps)
    return [{ value, loading, error }, load]
}
