import { IO } from './connect'

async function getConstrain({ width, height, devicePixelRatio }: {
    width: number
    height: number
    devicePixelRatio: number
}) {
    // Note: it's strange that you can only modify title once
    if (!document.title.startsWith('-rtc-uuid-')) {
        document.title = '-rtc-uuid-' + Math.random().toString(16).slice(2, 10)
    }
    const { ipcRenderer } = require('electron'),
        sources = await ipcRenderer.invoke('desktop-get-sources', { types: ['window'] }) as any[],
        source = sources.find(item => item.name.includes('App - Google Chrome'))
    if (!source) {
        throw Error(`source ${document.title} is not found`)
    }
    const w = (width || 1280) * (devicePixelRatio || 1),
        h = (height || 720) * (devicePixelRatio || 1)
    return {
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: source.id,
                minWidth: w,
                maxWidth: w,
                maxHeight: h,
                minHeight: h,
            }
        }
    }
}

export default async function send(api: IO, opts: any, peerOpts?: RTCConfiguration) {
    const conn = new RTCPeerConnection(peerOpts)
    api.on('icecandidate', data => {
        data && conn.addIceCandidate(new RTCIceCandidate(data))
    })
    conn.addEventListener('icecandidate', evt => {
        api.send('icecandidate', evt.candidate)
    })
    conn.addEventListener('connectionstatechange', () => {
        const state = conn.connectionState
        if (state === 'connected' || state === 'failed') {
            api.close()
        }
    })

    const data = conn.createDataChannel('cmd'),
        constrain = await getConstrain(opts),
        stream = await navigator.mediaDevices.getUserMedia(constrain as any)
    for (const track of stream.getTracks()) {
        conn.addTrack(track)
    }

    const offer = await conn.createOffer()
    await conn.setLocalDescription(offer)
    await api.send('offer', offer)
    const answer = await api.wait('answer')
    await conn.setRemoteDescription(new RTCSessionDescription(answer))
    return { conn, data }
}
