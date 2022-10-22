import { useEffect } from "react"
import connect, { IO } from "../../utils/cast/connect"
import send from "../../utils/cast/send"

export default function Sender({ api, children, peerOpts }: {
    api: IO,
	children?: any
	peerOpts?: RTCConfiguration
}) {
	useEffect(() => {
		api.on('start', async ({ sess, opts }) => {
			if (opts.width && opts.height) {
				const width = opts.width + (window.outerWidth - window.innerWidth),
					height = opts.height + (window.outerHeight - window.innerHeight)
				window.resizeTo(width, height)
			}
			const { data } = await send(connect(sess), opts, peerOpts)
			data.addEventListener('message', event => {
				const { evt, data } = JSON.parse(event.data),
					{ type, clientX, clientY, ...rest } = data || { },
					elem = document.elementFromPoint(clientX, clientY),
					params = {
						view: window, bubbles: true, cancelable: true,
						clientX, clientY, ...rest
					}
				if (evt === 'pointer') {
					elem?.dispatchEvent(new PointerEvent(type, params))
				} else if (evt === 'mouse') {
					elem?.dispatchEvent(new MouseEvent(type, params))
				} else if (evt === 'wheel') {
					// FIXME: wheel event not working
					elem?.dispatchEvent(new MouseEvent(type, params))
				}
			})
		})

		let lastActive = Date.now()
		api.on('ping', data => {
			api.send('pong', data)
			lastActive = Date.now()
		})

		const timer = setInterval(() => {
			(Date.now() - lastActive > 60 * 1000) && window.close()
		}, 10000)
		return () => clearInterval(timer)
	}, [api])
    return children
}

