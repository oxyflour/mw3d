import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import lambda from '../lambda'
import worker from '../utils/data/worker'
import { Entity } from '../utils/data/entity'
import { upload } from '../utils/dom/upload'

import './index.less'

export const loading = <div className="flex h-screen">
    <div className="m-auto">
        Loading...
    </div>
</div>

const entityCache = new WeakMap<Entity[], string>()
export function useEntities(current?: string) {
    const [ents, saveEnts] = useState([] as Entity[]),
        nav = useNavigate()
    async function setEnts(ents: Entity[]) {
        saveEnts(ents)
        const commit = await worker.sha256(ents)
        if (commit !== current) {
            entityCache.set(ents, commit)
            localStorage.setItem(commit, JSON.stringify(ents))
            nav(`/commit/${commit}`)
        }
    }
    useEffect(() => {
        const commit = entityCache.get(ents)
        if (commit !== current && current) {
            const ents = JSON.parse(localStorage.getItem(current) || '[]')
            entityCache.set(ents, current)
            saveEnts(ents)
        }
    }, [ents, current])
    return [ents, setEnts] as [typeof ents, typeof setEnts]
}

export default () => {
    const [, setEnts] = useEntities()
    return <button onClick={
        () => upload(async files => {
            const arr = files ? Array.from(files) : [],
                ents = []
            for await (const msg of lambda.open(arr)) {
                if (msg.entities) {
                    ents.push(...msg.entities)
                }
            }
            setEnts(ents)
        })
    }>open</button>
}
