import os from 'os'
import { Worker } from 'worker_threads'

import wrap from './wrap'
import { sha256 } from './common'

export default wrap({
    num: os.cpus().length,
    fork: () => new Worker(__filename, { execArgv: __filename.endsWith('.ts') ? ['-r', 'ts-node/register'] : [] }),
    api: {
        async sha256(buf: Uint8Array) {
            return sha256(Buffer.from(buf))
        }
    }
})
