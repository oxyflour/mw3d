import Redis from "ioredis"
import { deflate as deflateRaw, unzip as unzipRaw } from 'zlib'
import { promisify } from 'node:util'
import { asyncCache } from "../common/cache"
import { sha256 } from "./common"

const unzip = promisify(unzipRaw),
    deflate = promisify(deflateRaw),
    getRedis = asyncCache(async () => new Redis())

class Store {
    constructor(public prefix = '') {
    }
    async get(key: string) {
        const zipped = await this.zipped(key)
        return await unzip(zipped)
    }
    async zipped(key: string) {
        const redis = await getRedis(),
            buf = await redis.getBuffer(this.prefix + key)
        if (!buf) {
            throw Error(`key ${key} not found`)
        }
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
        async get(key: string) {
            try {
                return await root.get(key)
            } catch (err) {
                const [data] = key.split('/g/')
                // TODO: parse data
                data
                return await root.get(key)
            }
        },
    },
}
