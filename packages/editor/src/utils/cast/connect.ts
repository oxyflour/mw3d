import { EventEmitter } from 'events'
import lambda from '../../lambda'

export default function connect(sess: string) {
	const ret = new EventEmitter(),
        peer = Math.random().toString(16).slice(2, 10)
    console.log(`peer id ${peer} for sess ${sess}`)
    async function listen() {
        for await (const message of lambda.sess.sub(sess)) {
            const { evt, data, ...rest } = JSON.parse(message)
            if (rest.peer !== peer) {
                ret.emit(evt, data)
            }
        }
    }
    listen().catch(() => { })
	return Object.assign(ret, {
        peer, sess,
		async send(evt: string, data = { } as any) {
            await lambda.sess.pub(sess, JSON.stringify({ evt, data, peer }))
		},
		wait(evt: string) {
			return new Promise<any>(resolve => ret.once(evt, resolve))
		},
		async close() {
            await lambda.sess.stop(sess)
		},
	})
}

export type Api = ReturnType<typeof connect>
