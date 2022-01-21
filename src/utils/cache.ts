export default function cache<K extends object, V>(create: (k: K) => V, dispose?:(k: K, v: V) => void) {
    const map = new WeakMap<K, V>(),
        ret = (k: K) => {
            let v = map.get(k)
            if (!v) {
                v = create(k)
                map.set(k, v)
            }
            return v
        },
        del = (k: K) => {
            const v = map.get(k)
            map.delete(k)
            dispose(k, v)
            return v
        }
    return Object.assign(ret, { del })
}
