import { useEffect } from "react"
import { Api } from "../../utils/cast/connect"
import send from "../../utils/cast/send"

export default function Sender({ api, children, peerOpts }: {
    api: Api,
	children?: any
	peerOpts?: RTCConfiguration
}) {
	useEffect(() => {
		async function onStart({ id, opts }: { id: string, opts: { width: number, height: number, devicePixelRatio: number } }) {
			const title = document.title
			document.title = api.sess
			const { data } = await send(id, opts, peerOpts)
			document.title = title

			data.addEventListener('message', event => {
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
				}
			})

			const width = opts.width + (window.outerWidth - window.innerWidth),
				// TODO: remove the "--enable-unsafe-webgpu" infobar
				height = opts.height + (window.outerHeight - window.innerHeight) + 40
			window.resizeTo(width, height)
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
    return children
}

