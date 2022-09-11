import crypto from 'crypto'

export function sha256(buf: Buffer | string) {
    return crypto.createHash('sha256').update(buf).digest('hex')
}
