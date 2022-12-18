import EventEmitter from "events"

export class Sock extends EventEmitter {
    readonly ws: WebSocket
    readonly ready: Promise<void>
    constructor(channel: string, prefix = '/pub-sub/') {
        super()
        const url = new URL(location.href)
        url.protocol = 'ws'
        url.pathname = prefix + channel
        const ws = this.ws = new WebSocket(url.toString())
        this.ready = new Promise<void>(resolve => {
            ws.addEventListener('open', () => resolve())
        })
        ws.addEventListener('message', evt => {
            const { event, data } = JSON.parse(`${evt.data}`) as any
            this.emit(event, data)
        })
    }
    wait<T = {}>(event: string) {
        return new Promise<T>(resolve => this.once(event, resolve))
    }
    async send(event: string, data = { } as any) {
        await this.ready
        this.ws.send(JSON.stringify({ event, data }))
    }
    close() {
        this.ws.close()
    }
}

export async function send(sess: string,
        castOpts: { width: number, height: number, devicePixelRatio: number },
        peerOpts: RTCConfiguration) {
    const conn = new RTCPeerConnection(peerOpts),
        ws = new Sock(`sess-${sess}`)
    ws.on('icecandidate', data => {
        data && conn.addIceCandidate(new RTCIceCandidate(data))
    })
    conn.addEventListener('icecandidate', evt => {
        ws.send('icecandidate', evt.candidate)
    })
    conn.addEventListener('connectionstatechange', () => {
        const state = conn.connectionState
        if (state === 'connected' || state === 'failed') {
            ws.close()
        }
    })

    const channels = [conn.createDataChannel('cmd')],
        tracks = [] as MediaStreamTrack[],
        stream = await navigator.mediaDevices.getDisplayMedia({
            audio: false,
            video: {
                width: castOpts.width * castOpts.devicePixelRatio,
                height: castOpts.height * castOpts.devicePixelRatio,
            }
        })
    for (const track of stream.getTracks()) {
        tracks.push(track)
        conn.addTrack(track)
    }
    function destroy() {
        for (const track of tracks) {
            track.stop()
        }
        for (const sender of conn.getSenders()) {
            conn.removeTrack(sender)
        }
        conn.close()
    }

    try {
        const offer = await conn.createOffer()
        await conn.setLocalDescription(offer)
        ws.send('offer', offer)
        const answer = await ws.wait<RTCSessionDescriptionInit>('answer')
        await conn.setRemoteDescription(new RTCSessionDescription(answer))
        return { conn, stream, channels, destroy }
    } catch (err) {
        destroy()
        throw err
    }
}

export async function recv(sess: string, peerOpts: RTCConfiguration) {
    const conn = new RTCPeerConnection(peerOpts),
        ws = new Sock(`sess-${sess}`)
    ws.on('icecandidate', data => {
        data && conn.addIceCandidate(new RTCIceCandidate(data))
    })
    conn.addEventListener('icecandidate', evt => {
        ws.send('icecandidate', evt.candidate)
    })
    conn.addEventListener('connectionstatechange', () => {
        const state = conn.connectionState
        if (state === 'connected' || state === 'failed') {
            ws.close()
        }
    })
    const waitStream = new Promise<MediaStream>((resolve, reject) => {
        conn.addEventListener('track', evt => {
            const [stream] = evt.streams
            if (stream) {
                resolve(stream)
            } else if (evt.track) {
                const stream = new MediaStream()
                stream.addTrack(evt.track)
                resolve(stream)
            }
        })
        conn.addEventListener('connectionstatechange', () => {
            conn.connectionState === 'failed' && reject()
        })
    })
    const waitChannel = new Promise<RTCDataChannel>((resolve, reject) => {
        conn.addEventListener('datachannel', evt => {
            resolve(evt.channel)
        })
        conn.addEventListener('connectionstatechange', () => {
            conn.connectionState === 'failed' && reject()
        })
    })
    function destroy() {
        for (const sender of conn.getSenders()) {
            conn.removeTrack(sender)
        }
        conn.close()
    }

    try {
        const offer = await ws.wait<RTCSessionDescriptionInit>('offer')
        await conn.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await conn.createAnswer()
        await conn.setLocalDescription(answer)
        ws.send('answer', answer)
        const channels = [await waitChannel],
            streams = [await waitStream]
        return { conn, streams, channels, destroy }
    } catch (err) {
        destroy()
        throw err
    }
}

type UnPromise<T> = T extends Promise<infer U> ? U : T

export default class Caster {
    readonly ws: Sock
    constructor(readonly channel: string) {
        this.ws = new Sock(channel)
    }
    private recving = { } as Partial<UnPromise<ReturnType<typeof recv>>>
    async recv({ elem, href, peerOpts = { } }: { elem: HTMLVideoElement, href: string, peerOpts?: RTCConfiguration }) {
        this.recving.destroy?.()
        const state = { count: 0 }
        function req(channel: string) {
            ws.send(`req`, { sess })
            if (state.count ++ % 5 == 4) {
                ws.send(`fork`, { href, channel })
            }
        }
        const { ws } = this,
            sess = Math.random().toString(16).slice(2, 10),
            timeout = setInterval(() => req(this.channel), 1000),
            { target } = await ws.wait<{ target: string }>(`res-${sess}`),
            castOpts = { width: elem.scrollWidth, height: elem.scrollHeight, devicePixelRatio: window.devicePixelRatio }
        ws.send(`ack`, { target, sess, castOpts, peerOpts })
        clearInterval(timeout)
        const recving = this.recving = await recv(sess, peerOpts)
        elem.muted = true
        elem.srcObject = recving.streams?.[0] || null
        elem.play()
        const ping = () => {
            const [channel] = recving.channels
            channel?.send(JSON.stringify({ ping: Date.now() }))
            channel && setTimeout(ping, 1000)
        }
        ping()
        return recving
    }
    private sending = { } as Partial<UnPromise<ReturnType<typeof send>>> & { lastActive?: number }
    async send({ sess, pid, castOpts, peerOpts }: any) {
        this.sending.destroy?.()
        // Note: for activating active tab
        document.title = `${this.channel}-${pid}`
        // Note: wait until 'Sharing this tab' bar popup
        const { width, height } = castOpts || { }
        width && height && setTimeout(() => {
            const top = window.outerHeight - window.innerHeight,
                left = window.outerWidth - window.innerWidth
            window.resizeTo(width + left, height + top)
        }, 1000)
        const sending = this.sending = await send(sess, castOpts, peerOpts),
            [channel] = sending.channels || []
        channel?.addEventListener('message', () => {
            this.sending.lastActive = Date.now()
        })
        return sending
    }
    async listen({ pid, peerOpts, callback } = { } as { pid?: string, peerOpts?: RTCConfiguration, callback?: (sending: Caster['sending']) => void }) {
        const target = Math.random().toString(16).slice(2, 10)
        this.ws.on('req', async ({ sess }: { sess: string }) => {
            this.ws.send(`res-${sess}`, { target })
        })
        this.ws.on('ack', async (opts: any) => {
            if (opts.target === target) {
                await this.send({ ...opts, pid, peerOpts: peerOpts || opts.peerOpts })
                callback?.(this.sending)
            }
        })
        this.sending.lastActive = Date.now()
        setInterval(() => {
            if (this.sending.lastActive && Date.now() - this.sending.lastActive > 30000) {
                console.warn(`quitting because inactive`)
                pid && this.ws.send('kill', { pid })
            }
        }, 1000)
        return this
    }
}
