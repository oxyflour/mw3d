export default function cache<A extends any[], V>(create: (...a: A) => V) {
    const map = new WeakMap<any, any>()
    return (...a: A) => {
        let m = map
        for (const [i, k] of a.entries()) {
            let n = m.get(k)
            if (!n) {
                n = i === a.length - 1 ?
                    create(...a) :
                    new WeakMap<any, any>()
                m.set(k, n)
            }
            m = n
        }
        return m as any as V
    }
}
