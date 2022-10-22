import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Receiver from '../comps/cast/receiver'
import Sender from '../comps/cast/sender'
import connect, { IO } from '../utils/cast/connect'

import './index.less'

const peerOpts = { iceServers: [{ urls: 'stun:172.24.197.158', username: 'abc', credential: 'abc', credentialType: 'password' as 'password' }] }

export function layout({ children }: { children: any }) {
    const [, sess = ''] = location.pathname.match(/\/sess\/(\w+)/) || [],
        nav = useNavigate(),
        [api, setApi] = useState<IO>()
    useEffect(() => {
        if (!sess) {
            nav(`/sess/${Math.random().toString(16).slice(2, 10)}`)
            return () => { }
        } else {
            const api = connect(sess)
            setApi(api)
            return () => { api.close() }
        }
    }, [sess])
    return api ?
        ('gpu' in navigator ?
            <Sender peerOpts={ peerOpts } api={ api }>{ children }</Sender> :
            <Receiver peerOpts={ peerOpts } api={ api } />) :
        'Loading...'
}

export default () => 'Starting New Session...'
