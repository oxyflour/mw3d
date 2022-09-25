import Redis from "ioredis"
import { asyncCache } from "../common/cache"

const getRedis = asyncCache(async () => new Redis())
export default  {
    async get(key: string) {
        const redis = await getRedis(),
            buf = await redis.getBuffer(key)
        if (!buf) {
            throw Error(`bufer ${key} not found`)
        }
        return buf
    },
    async set(key: string, buf: Buffer) {
        const redis = await getRedis()
        await redis.set(key, buf, 'EX', 1000)
        return key
    },
}
