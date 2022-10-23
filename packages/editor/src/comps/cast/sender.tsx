import { useEffect, useState } from "react"
import { Api } from "../../utils/cast/connect"
import send from "../../utils/cast/send"

type Unwarp<T> = T extends Promise<infer U> ? U : T

export default function Sender({ api, children, peerOpts }: {
    api: Api,
    children?: any
    peerOpts?: RTCConfiguration
}) {
    const [peer, setPeer] = useState({ } as Partial<Unwarp<ReturnType<typeof send>>>),
        { data, conn, stream } = peer

    useEffect(() => {
        async function onStart({ id, opts }: {
			id: string
			opts: { width: number, height: number, devicePixelRatio: number }
		}) {
            const title = document.title
            document.title = api.sess
            const peer = await send(id, opts, peerOpts)
            document.title = title
            setPeer(peer)
			// skip the "Stop Sharing" infobar animation
            setTimeout(() => {
                const width = opts.width + (window.outerWidth - window.innerWidth),
                    height = opts.height + (window.outerHeight - window.innerHeight)
                window.resizeTo(width, height)
            }, 500)
        }

        let lastActive = Date.now()
        function onPing(data: { evt?: string }) {
            api.send(data.evt || 'pong', { ...data, peer: api.peer })
            lastActive = Date.now()
        }

        api.on('ping', onPing)
        api.on(api.peer, onStart)
        const timer = setInterval(() => {
            (Date.now() - lastActive > 60 * 1000) && window.close()
        }, 10000)
        return () => {
            api.removeListener(api.peer, onStart)
            api.removeListener('ping', onPing)
            clearInterval(timer)
        }
    }, [api])

    useEffect(() => {
        function onMessage(event: MessageEvent<any>) {
            const { evt, data } = JSON.parse(event.data),
                { type, clientX, clientY, ...rest } = data || { },
                elem = document.elementFromPoint(clientX, clientY),
                params = { view: window, bubbles: true, cancelable: true, clientX, clientY, ...rest }
            if (evt === 'pointer') {
                elem?.dispatchEvent(new PointerEvent(type, params))
            } else if (evt === 'mouse') {
                elem?.dispatchEvent(new MouseEvent(type, params))
            } else if (evt === 'wheel') {
                elem?.dispatchEvent(new WheelEvent(type, params))
            } else if (evt === 'key') {
                // not yet working
                elem?.dispatchEvent(new KeyboardEvent(type, params))
            }
        }
        data?.addEventListener('message', onMessage)
        return () => {
            for (const track of stream?.getTracks() || []) {
                track.stop()
            }
            data?.removeEventListener('message', onMessage)
            data?.close()
            conn?.close()
        }
    }, [peer])

    return children
}

