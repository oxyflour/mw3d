import { useEffect, useState } from "react"
import connect, { IO } from "../../utils/cast/connect"
import recv from "../../utils/cast/recv"
import { debounce } from "../../utils/common/debounce"
import { useAsync } from "../../utils/react/hooks"

export type HtmlVideoProps = React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>

export default function Receiver({ api, children, peerOpts, href = location.href, ...rest }: {
    api: IO,
    peerOpts?: RTCConfiguration
    href?: string
} & HtmlVideoProps) {
    const [video, setVideo] = useState<HTMLVideoElement>(),
        [{ loading, error }] = useAsync(async video => video && await start(video), [video]),
        [peer, setPeer] = useState({
            conn: null as null | RTCPeerConnection,
            streams: [] as MediaStream[],
            channels: [] as RTCDataChannel[]
        })

    async function start(video: HTMLVideoElement) {
        const width = video.width = video.scrollWidth,
            height = video.height = video.scrollHeight,
            { devicePixelRatio } = window,
            opts = { width, height, devicePixelRatio },
            sess = Math.random().toString(16).slice(2, 10)
        await api.send('start', { sess, opts, href })
        const peer = await recv(connect(sess), peerOpts)
        video.srcObject = peer.streams[0]!
        video.play()
        setPeer(peer)
    }

    useEffect(() => {
        api.on('pong', ({ now }) => {
            console.log('ping', Date.now() - now)
        })
        const timer = setInterval(() => {
            api.send('ping', { now: Date.now() })
        }, 10000)
        return () => clearInterval(timer)
    }, [api])

    useEffect(() => {
        const cbs = [
            'pointerdown', 'pointermove', 'pointerup',
            'mousedown', 'mousemove', 'mouseup', 'click', 'dblclick',
            'wheel',
        ].map((type => {
            function func({ button, clientX, clientY, deltaX, deltaY }: any) {
                const [channel] = peer.channels,
                    evt = type === 'wheel' ? 'wheel' :
                        type.startsWith('pointer') ? 'pointer' :
                        'mouse',
                    data = { type, button, clientX, clientY, deltaX, deltaY }
                channel?.send(JSON.stringify({ evt, data }))
            }
            window.addEventListener(type as any, func)
            return { type, func } as any
        }))
        const onWindowResize = debounce(async () => video && start(video), 500)
        window.addEventListener('resize', onWindowResize)
        const onStateChange = () => console.log(peer.conn?.connectionState)
        peer.conn?.addEventListener('connectionstatechange', onStateChange)
        return () => {
            cbs.forEach(({ type, func }) => window.removeEventListener(type, func))
            window.removeEventListener('resize', onWindowResize)
            peer.conn?.removeEventListener('connectionstatechange', onStateChange)
            peer.conn?.close()
        }
    }, [peer])

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
                error ? <div style={{ cursor: 'pointer' }}
                        onClick={ () => video && start(video) }>
                    Error: { `${error && (error as any).meessage || error}` }, click to retry
                </div> :
                <div>
                    loading...
                </div>
            }
            </div>
        }
        <video muted ref={ video => setVideo(video || undefined) } style={{ objectFit: 'cover' }} { ...rest } />
    </>
}
