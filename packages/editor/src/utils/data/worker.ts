import { Utils } from "@ttk/core"
import { unpack } from "../common/pack"
import { pool } from "../common/pool"

import WorkerSelf from './worker?worker&inline'

async function load(url: string) {
    const href = location.href.replace(/^blob:/, ''),
        abs = new URL(`/static/geom/${url}`, href),
        req = await fetch(abs.toString())
    return await req.arrayBuffer()
}

const list = Array(5).fill(0).map(() => pool(load))
export default Utils.wrap({
    num: navigator.hardwareConcurrency,
    fork: () => new (WorkerSelf as any)(),
    api: {
        assets: {
            async get(url: string) {
                const buf = await list[Math.floor(Math.random() * list.length)]!(url)
                return unpack(new Uint8Array(buf))
            }
        },
        async sha256(data: any) {
            const buf = new TextEncoder().encode(JSON.stringify(data)).buffer,
                arr = await crypto.subtle.digest('SHA-256', buf)
            return Array.from(new Uint8Array(arr)).map(b => b.toString(16).padStart(2, '0')).join('')
        }
    }
})
