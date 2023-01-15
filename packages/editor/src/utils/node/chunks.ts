import { readFile, writeFile } from "fs/promises"
import { pack } from "../common/pack"

export class Chunks {
    constructor(readonly arr = [] as Uint8Array[]) {
    }
    private offset = 0
    append(data: any) {
        const buf = data instanceof Uint8Array ? data : pack(data),
            ret = { offset: this.offset, size: buf.byteLength }
        this.arr.push(buf)
        this.offset += buf.byteLength
        return ret
    }
    async write(file: string) {
        await writeFile(file, Buffer.concat(this.arr))
    }
    static async read(file: string) {
        const buf = await readFile(file)
        return {
            slice({ offset, size }: { offset?: number, size?: number }) {
                return buf.slice(offset || 0, (offset || 0) + (size || buf.byteLength))
            }
        }
    }
}
