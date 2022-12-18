import { useEffect, useMemo, useState } from "react"
import { debounce, useAsync } from "../utils"
import Caster from "./caster"

export type HtmlVideoProps = React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>

export default function Receiver({ channel = Math.random().toString(16).slice(2, 10), children, peerOpts, href = location.href, ...rest }: {
    channel?: string
    peerOpts?: RTCConfiguration
    href?: string
} & HtmlVideoProps) {
    const [elem, setElem] = useState<HTMLVideoElement | null>(null),
        caster = useMemo(() => new Caster(channel), [channel]),
        [restart, setRestart] = useState(0),
        [{ value: recving, loading, error }] = useAsync(async elem => elem ? await caster.recv({ elem, href, peerOpts }) : { } as Caster['recving'], [elem, restart], { })
    useEffect(() => {
        const { conn, channels: [channel] = [] } = recving || { },
            pos = { clientX: 0, clientY: 0 }
        const cbs = [
            'pointerdown', 'pointermove', 'pointerup',
            'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick',
            'wheel',
            'keydown', 'keyup',
        ].map((type => {
            const evt = type === 'wheel' ? 'wheel' :
                type.startsWith('pointer') ? 'pointer' :
                type.startsWith('key') ? 'key' :
                    'mouse'
            function func({ button, deltaX, deltaY, key, clientX = pos.clientX, clientY = pos.clientY }: any) {
                const data = { type, button, clientX, clientY, deltaX, deltaY, key }
                Object.assign(pos, data)
                channel?.send(JSON.stringify({ evt, data }))
            }
            window.addEventListener(type as any, func)
            return { type, func } as any
        }))
        const onWindowResize = debounce(async () => setRestart(restart + 1), 500)
        window.addEventListener('resize', onWindowResize)
        const onStateChange = () => {
            const state = conn?.connectionState
            if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                setRestart(restart + 1)
            }
        }
        conn?.addEventListener('connectionstatechange', onStateChange)
        return () => {
            cbs.forEach(({ type, func }) => window.removeEventListener(type, func))
            window.removeEventListener('resize', onWindowResize)
            conn?.removeEventListener('connectionstatechange', onStateChange)
        }
    }, [recving])

    return <>
        {
            (error || loading) &&
            <div style={{
                position: 'absolute',
                zIndex: 100,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#ddd',
                textAlign: 'center',
                padding: 8,
            }}>
            {
                error ? <div style={{ cursor: 'pointer' }} onClick={ () => setRestart(restart + 1) }>
                    Error: { `${error && error.meessage || error}` }, click to retry
                </div> :
                <div>
                    loading...
                </div>
            }
            </div>
        }
        <video muted
            ref={ video => setElem(video) }
            style={{ width: '100%', height: '100%', objectPosition: '0 0' }}
            { ...rest } />
    </>
}

