import { EventEmitter } from 'events'
import lambda from '../../lambda'

export default function connect(sess: string) {
	const ret = new EventEmitter(),
        self = Math.random().toString(16).slice(2, 10)
    async function listen() {
        for await (const message of lambda.sess.sub(sess)) {
            const { evt, data, ...rest } = JSON.parse(message)
            if (rest.self !== self) {
                ret.emit(evt, data)
            }
        }
    }
    listen()
	return Object.assign(ret, {
		async send(evt: string, data = { } as any) {
            await lambda.sess.pub(sess, JSON.stringify({ self, evt, data }))
		},
		wait(evt: string) {
			return new Promise<any>(resolve => ret.once(evt, resolve))
		},
		async close() {
            await lambda.sess.stop(sess)
		},
	})
}

export type IO = ReturnType<typeof connect>
