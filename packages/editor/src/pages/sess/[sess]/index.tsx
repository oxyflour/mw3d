import { useEffect, useRef } from 'react'
import { RouteMatch, useNavigate } from 'react-router-dom'
import { Utils } from '@ttk/react'

import lambda from '../../../lambda'
import { Entity } from '../../../utils/data/entity'
import { queue } from '../../../utils/common/queue'

const runInQueue = queue((func: () => Promise<any>) => func()),
    entityCache = new WeakMap<Entity[], string>(),
    commitCache = new Utils.LRU<Entity[]>()
export function EntityStore({ entities, setEntities, params: { sess, commit } }: {
    entities?: Entity[]
    setEntities?: (entities: Entity[]) => void
    params: { sess?: string, commit?: string }
}) {
    const nav = useNavigate(),
        { current } = useRef({ commit, entities })
    current.commit = commit
    current.entities = entities
    async function saveEntities(entities: Entity[]) {
        const commit = entityCache.get(entities) || await lambda.commit.save({ entities })
        if (commit !== current.commit && entities === current.entities) {
            entityCache.set(entities, commit)
            commitCache.set(commit, entities)
            nav(`/sess/${sess}/commit/${commit}`)
        }
    }
    async function loadCommit(commit: string) {
        const entities = commitCache.get(commit) || (await lambda.commit.get(commit)).entities
        if (commit === current.commit && entities !== current.entities) {
            entityCache.set(entities, commit)
            commitCache.set(commit, entities)
            setEntities?.(entities)
        }
    }
    useEffect(() => { commit && runInQueue(() => loadCommit(commit)) }, [commit])
    useEffect(() => { entities && runInQueue(() => saveEntities(entities)) }, [entities])
    return null
}

export default ({ params }: RouteMatch<'sess'>) => {
    return <EntityStore entities={ [] } params={ params } />
}
