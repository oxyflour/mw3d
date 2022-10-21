export class LRU<T> {
    map = { } as Record<string, { time: number, val: T }>
    constructor(readonly capacity = 100) {
    }
    get(key: string | number) {
        const ret = this.map[key]
        ret && (ret.time = Date.now())
        return ret?.val
    }
    set(key: string | number, val: T) {
        const ret = this.map[key] = { time: Date.now(), val }
        if (Object.keys(this.map).length > this.capacity) {
            const [item] = Object.entries(this.map).sort(([, a], [, b]) => a.time - b.time)
            item && delete this.map[item[0]]
        }
        return ret?.val
    }
}
