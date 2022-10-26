import Redis from "ioredis"
import path from 'path'
import os from 'os'
import { deflate as deflateRaw, unzip as unzipRaw } from 'zlib'
import { promisify } from 'node:util'
import { asyncCache } from "../common/cache"
import { sha256 } from "./common"
import { mkdir, readFile, writeFile } from "fs/promises"
import { Entity } from "../data/entity"

const unzip = promisify(unzipRaw),
    deflate = promisify(deflateRaw),
    getRedis = asyncCache(async () => new Redis()),
    getReceiver = asyncCache(async () => {
        const redis = new Redis()
        redis.on('message', (channel, message) => {
            for (const cb of callbacks[channel] || []) {
                cb(message)
            }
        })
        return redis
    }),
    callbacks = { } as Record<string, ((message: string) => any)[]>

class Store {
    constructor(public prefix = '', public persistent = '', public ex = 3600) {
    }
    async sub(evt: string, callback: (message: any) => any) {
        const redis = await getReceiver(),
            channel = this.prefix + evt
        callbacks[channel] = (callbacks[channel] || []).concat(data => callback(JSON.parse(data)))
        await redis.subscribe(channel)
        return async () => {
            const cbs = callbacks[channel] = (callbacks[channel] || []).filter(item => item !== callback)
            if (!cbs.length) {
                await redis.unsubscribe(channel)
                delete callbacks[channel]
            }
        }
    }
    async pub(evt: string, message: any) {
        const redis = await getRedis(),
            channel = this.prefix + evt
        await redis.publish(channel, JSON.stringify(message))
    }
    async get(key: string, ex = this.ex) {
        const zipped = await this.zipped(key, ex)
        return await unzip(zipped)
    }
    async set(key: string, buf: Buffer, ex = this.ex) {
        const redis = await getRedis(),
            zipped = await deflate(buf)
        await redis.set(key, zipped, 'EX', ex)
    }
    async zipped(key: string, ex = this.ex) {
        const redis = await getRedis()
        let buf = await redis.getBuffer(this.prefix + key)
        if (!buf) {
            if (this.persistent) {
                buf = await readFile(path.join(this.persistent, this.prefix + key))
            } else {
                throw Error(`key ${key} not found`)
            }
        }
        await redis.expire(this.prefix + key, ex)
        return buf
    }
    async save(buf: Buffer, prefix = '', ex = this.ex) {
        const redis = await getRedis(),
            zipped = await deflate(buf),
            key = prefix + sha256(buf)
        if (this.persistent) {
            const dest = path.join(this.persistent, this.prefix + key)
            mkdir(path.dirname(dest), { recursive: true })
            await writeFile(dest, zipped)
        }
        return await redis.set(this.prefix + key, zipped, 'EX', ex), key
    }
}

const library = new Store('library/', path.join(os.homedir(), '.ttk')),
    cache = new Store('cache/')
export default {
    library,
    cache,
    commit: {
        async save(data: { entities: Entity[] }) {
            const buf = Buffer.from(JSON.stringify(data)),
                key = await library.save(buf, 'commit/')
            return key.split('/').slice(1).join('/')
        },
        async get(commit: string) {
            const buf = await library.get(`commit/${commit}`)
            return JSON.parse(buf.toString()) as { entities: Entity[] }
        },
    },
    geom: {
        async cache(buf: Buffer, data: string) {
            return await cache.save(buf, data + '/g/')
        },
    },
}
