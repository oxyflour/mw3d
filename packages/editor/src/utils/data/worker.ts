import { Utils } from "@ttk/core"
import { unpack } from "../common/pack"
import { pool } from "../common/pool"

import WorkerSelf from './worker?worker&inline'

const list = Array(5).fill(0).map(() => pool(async (url: string) => {
    const req = await fetch(`/static/assets/${url}`)
    return await req.arrayBuffer()
}))
export default Utils.wrap({
    num: navigator.hardwareConcurrency,
    fork: () => new (WorkerSelf as any)(),
    api: {
        assets: {
            async get(url: string) {
                const load = list[Math.floor(Math.random() * list.length)]!,
                    buf = await load(url)
                return unpack(new Uint8Array(buf))
            }
        }
    }
})
