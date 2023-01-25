import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Center } from '../comps/utils/center'
import { CgSpinnerTwo } from 'react-icons/cg'

import './index.less'

export function layout({ children }: { children: any }) {
    const [, sess = ''] = location.pathname.match(/\/sess\/(\w+)/) || [],
        nav = useNavigate()
    useEffect(() => { sess || nav(`/sess/${Math.random().toString(16).slice(2, 10)}`) }, [sess])
    return children
}

export function loading() {
    return <Center style={{ height: '100%' }}>
        <CgSpinnerTwo className="icon-spin" /> Loading
    </Center>
}

export default () => 'Starting New Session...'
