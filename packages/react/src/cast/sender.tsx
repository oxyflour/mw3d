import { useEffect, useMemo } from "react"
import Caster from "./caster"

const query = Object.fromEntries(location.search
    .replace(/^\?/, '').split('&')
    .map(line => line.split('=')))
export default function Sender({ pid = query.pid, channel = query.channel, children, peerOpts }: {
    channel?: string
    pid?: string
    children?: any
    peerOpts?: RTCConfiguration
}) {
    const caster = useMemo(() => new Caster(channel), [channel])
    function callback({ channels: [channel] = [] }: Caster['sending']) {
        function onMessage(event: MessageEvent<any>) {
            const { evt, data } = JSON.parse(event.data),
                { type, clientX, clientY, ...rest } = data || { },
                elem = clientX && clientY && document.elementFromPoint(clientX, clientY),
                params = { view: window, bubbles: true, cancelable: true, clientX, clientY, ...rest }
            if (evt === 'pointer') {
                elem?.dispatchEvent(new PointerEvent(type, params))
            } else if (evt === 'mouse') {
                elem?.dispatchEvent(new MouseEvent(type, params))
            } else if (evt === 'wheel') {
                elem?.dispatchEvent(new WheelEvent(type, params))
            } else if (evt === 'key') {
                elem?.dispatchEvent(new KeyboardEvent(type, params))
            }
        }
        channel?.addEventListener('message', onMessage)
    }
    useEffect(() => {
        caster.listen({ pid, peerOpts, callback })
    }, [caster])
    return children
}


