import Redis from "ioredis"
import { deflate as deflateRaw, unzip as unzipRaw } from 'zlib'
import { promisify } from 'node:util'
import { asyncCache } from "../common/cache"
import { sha256 } from "./common"

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
    constructor(public prefix = '') {
    }
    async sub(channel: string, callback: (message: any) => any) {
        const redis = await getReceiver()
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
    async pub(channel: string, message: any) {
        const redis = await getRedis()
        await redis.publish(channel, JSON.stringify(message))
    }
    async get(key: string, ex = 1000) {
        const zipped = await this.zipped(key, ex)
        return await unzip(zipped)
    }
    async set(key: string, buf: Buffer, ex = 1000) {
        const redis = await getRedis(),
            zipped = await deflate(buf)
        await redis.set(key, zipped, 'EX', ex)
    }
    async zipped(key: string, ex = 1000) {
        const redis = await getRedis(),
            buf = await redis.getBuffer(this.prefix + key)
        if (!buf) {
            throw Error(`key ${key} not found`)
        }
        await redis.expire(this.prefix + key, ex)
        return buf
    }
    async save(buf: Buffer, prefix = this.prefix) {
        // TODO:
        const key = prefix + sha256(buf)
        return await this.cache(buf), key
    }
    async cache(buf: Buffer, prefix = this.prefix, ex = 1000) {
        const redis = await getRedis(),
            zipped = await deflate(buf),
            key = prefix + sha256(buf)
        return await redis.set(key, zipped, 'EX', ex), key
    }
}

const root = new Store()
export default {
    root,
    data: {
        async save(buf: Buffer) {
            return await root.save(buf, 'data/')
        },
        async get(key: string) {
            return await root.get(key)
        },
    },
    geom: {
        async cache(buf: Buffer, data: string) {
            return await root.cache(buf, data + '/g/')
        },
    },
}
