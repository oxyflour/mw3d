export default class Cache<K extends object, V> {
    private data = new WeakMap<K, V>()
    get(k: K) {
        return this.data.get(k)
    }
    set(k: K, v: V) {
        this.data.set(k, v)
        return v
    }
}
