import { useEffect, useState } from "react"

const savedIntCacne = { } as Record<string, number>
export function useSavedInt(key: string, init: number) {
    const saved = key in savedIntCacne ? savedIntCacne[key]! :
            (savedIntCacne[key] = parseInt(localStorage.getItem(key) || init + '')),
        ret = useState(saved),
        [val] = ret
    useEffect(() => localStorage.setItem(key, val + ''), [val])
    return ret
}
