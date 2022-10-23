import connect from './connect'

export default async function send(id: string,
        castOpts: { width: number, height: number, devicePixelRatio: number },
        peerOpts?: RTCConfiguration) {
    const conn = new RTCPeerConnection(peerOpts),
        api = connect(id)
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
        stream = await navigator.mediaDevices.getDisplayMedia({
            audio: false,
            video: {
                width: castOpts.width * castOpts.devicePixelRatio,
                height: castOpts.height * castOpts.devicePixelRatio,
            }
        })
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
