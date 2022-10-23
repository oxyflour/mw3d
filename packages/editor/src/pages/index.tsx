import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Receiver from '../comps/cast/receiver'
import Sender from '../comps/cast/sender'
import connect, { Api } from '../utils/cast/connect'

import './index.less'

const peerOpts = { iceServers: [{ urls: 'stun:172.24.197.158', username: 'abc', credential: 'abc', credentialType: 'password' as 'password' }] }

export function layout({ children }: { children: any }) {
    const [, sess = ''] = location.pathname.match(/\/sess\/(\w+)/) || [],
        nav = useNavigate(),
        [api, setApi] = useState<Api>()
    useEffect(() => {
        if (!sess) {
            nav(`/sess/${Math.random().toString(16).slice(2, 10)}`)
        } else {
            setApi(connect(sess))
        }
    }, [sess])
    console.log('session', sess, location.pathname)
    return api ?
        ('gpu' in navigator ?
            <Sender peerOpts={ peerOpts } api={ api }>{ children }</Sender> :
            <Receiver peerOpts={ peerOpts } api={ api } style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: '0 0' }} />) :
        'Loading...'
}

export default () => 'Starting New Session...'
