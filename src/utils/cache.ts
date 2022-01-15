export default class Cache<K extends object, V> {
    static create<K extends object, V>(func: (k: K) => V) {
        const map = new Cache<K, V>(),
            ret = (k: K) => map.get(k) || map.set(k, func(k))
        return Object.assign(ret, { map })
    }
    private data = new WeakMap<K, V>()
    get(k: K) {
        return this.data.get(k)
    }
    set(k: K, v: V) {
        this.data.set(k, v)
        return v
    }
    del(k: K) {
        const v = this.data.get(k)
        this.data.delete(k)
        return v
    }
}
