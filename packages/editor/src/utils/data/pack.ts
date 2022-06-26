const enc = new TextEncoder(),
    dec = new TextDecoder()

const types = [
    String,
    Int8Array,
    Uint8Array,
    Uint8ClampedArray,
    Int16Array,
    Uint16Array,
    Int32Array,
    Uint32Array,
    Float32Array,
    Float64Array,
]

type Packable = (
    Int8Array |
    Uint8Array |
    Uint8ClampedArray |
    Int16Array |
    Uint16Array |
    Int32Array |
    Uint32Array |
    Float32Array |
    Float64Array
)

export function pack(data: any) {
    const arr = [] as { type: number, length: number, body: Uint8Array }[],
        json = JSON.stringify(data, (_, val) => {
            const type = val?.byteLength && types.findIndex(type => val instanceof type)
            if (type >= 0) {
                const idx = arr.length,
                    buf = val as Packable,
                    body = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
                arr.push({ type, length: buf.length, body })
                return { __buf__: idx }
            }
            return val
        })

    const str = enc.encode(json),
        head = new Uint32Array([0, 0, 0, 0]),
        space = Math.ceil((head.byteLength + str.byteLength) / 8) * 8,
        chunks = [{ type: arr.length, start: 0, space, end: space, length: str.length, body: str }]
    for (const { body, length, type } of arr) {
        const space = Math.ceil((head.byteLength + body.byteLength) / 8) * 8,
            last = chunks[chunks.length - 1]!,
            start = last.start + last.space,
            end = start + space
        chunks.push({ type, start, space, end, length, body })
    }

    const buf = new Uint8Array(chunks[chunks.length - 1]!.end)
    for (const { type, start, length, space, body } of chunks) {
        head.set([type, length, start + space])
        buf.set(new Uint8Array(head.buffer), start)
        buf.set(body, start + head.byteLength)
    }
    return buf
}

export function unpack(buf: Uint8Array) {
    const head = new Uint32Array(buf.buffer, 0, 4),
        [num = 0, length = 0, end = 0] = head,
        json = dec.decode(buf.slice(head.byteLength, head.byteLength + length)),
        arr = [] as Packable[]
    for (let i = 0, start = end; i < num; i ++) {
        const head = new Uint32Array(buf.buffer, start, 4),
            [type = 0, length = 0, end = 0] = head,
            constructor = types[type]
        if (!constructor) {
            throw Error(`unknown buffer type id ${type}`)
        }
        arr.push(new constructor(buf.buffer, start + head.byteLength, length) as any)
        start = end
    }
    return JSON.parse(json, (_, val) => {
        if (val?.__buf__ !== undefined) {
            return arr[val?.__buf__]
        }
        return val
    })
}
