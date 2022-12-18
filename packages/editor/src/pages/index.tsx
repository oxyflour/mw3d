import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sender, Receiver } from '@ttk/react'

import './index.less'

const peerOpts = {
    iceServers: [{
        urls: 'turn:172.31.60.216',
        username: 'any',
        credential: 'any',
        credentialType: 'password'
    }, {
        urls: 'stun:172.31.60.216',
    }]
} as RTCConfiguration

export function layout({ children }: { children: any }) {
    const [, sess = ''] = location.pathname.match(/\/sess\/(\w+)/) || [],
        nav = useNavigate()
    useEffect(() => { sess || nav(`/sess/${Math.random().toString(16).slice(2, 10)}`) }, [sess])
    return navigator.gpu ?
        <Sender peerOpts={ peerOpts }>{ children }</Sender> :
        <Receiver peerOpts={ peerOpts } channel={ sess } />
}

export function loading() {
    return <div>loading...</div>
}

export default () => 'Starting New Session...'
