class Dict<K = any, V = any> {
    weak = new WeakMap<K extends Object ? K : { }, V>()
    dict = { } as Record<string, any>
    get(k: any) {
        return typeof k === 'object' ? this.weak.get(k) : this.dict[k]
    }
    set(k: any, v: any) {
        typeof k === 'object' ? this.weak.set(k, v) : (this.dict[k] = v)
    }
}

export default function cache<A extends any[], V>(create: (...a: A) => V) {
    const map = new Dict()
    return (...a: A) => {
        let m = map
        for (let i = 0; i < a.length; i ++) {
            const k = a[i]
            let n = m.get(k)
            if (!n) {
                n = i === a.length - 1 ? create(...a) : new Dict()
                m.set(k, n)
            }
            m = n
        }
        return m as any as V
    }
}
