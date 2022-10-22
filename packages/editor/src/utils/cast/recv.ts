import { IO } from './connect'

export default async function recv(api: IO, peerOpts?: RTCConfiguration) {
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

	const streams = [] as MediaStream[],
		channels = [] as RTCDataChannel[]
	conn.addEventListener('track', evt => {
		const [stream] = evt.streams
		if (stream) {
			streams.push(stream)
		} else if (evt.track) {
			const stream = new MediaStream()
			stream.addTrack(evt.track)
			streams.push(stream)
		}
	})
	conn.addEventListener('datachannel', evt => {
		channels.push(evt.channel)
	})

	const offer = await api.wait('offer')
	await conn.setRemoteDescription(new RTCSessionDescription(offer))
	const answer = await conn.createAnswer()
	await conn.setLocalDescription(answer)
	await api.send('answer', answer)
	return { conn, streams, channels }
}
