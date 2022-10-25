import { useEffect, useRef, useState } from 'react'
import { RouteMatch, useNavigate } from 'react-router-dom'

import lambda from '../../../lambda'
import { Entity } from '../../../utils/data/entity'
import { Utils } from '@ttk/core'

const entityCache = new WeakMap<Entity[], string>(),
    commitCache = new Utils.LRU<Entity[]>()
export function useEntities(sess = '', commit = '') {
    const [entities, saveEntities] = useState([] as Entity[]),
        nav = useNavigate(),
        ref = useRef(commit)
    ref.current = commit
    async function setEntities(entities: Entity[]) {
        saveEntities(entities)
        const commit = entityCache.get(entities) || await lambda.commit.save({ entities })
        if (commit !== ref.current) {
            entityCache.set(entities, commit)
            commitCache.set(commit, entities)
            nav(`/sess/${sess}/commit/${commit}`)
        }
    }
    async function loadCommit(commit: string) {
        const entities = commitCache.get(commit) || (await lambda.commit.get(commit)).entities
        if (commit === ref.current) {
            entityCache.set(entities, commit)
            commitCache.set(commit, entities)
            saveEntities(entities)
        }
    }
    useEffect(() => { commit ? loadCommit(commit) : setEntities([]) }, [commit])
    return [entities, setEntities] as [typeof entities, typeof setEntities]
}

export default ({ params }: RouteMatch<'sess'>) => {
    useEntities(params.sess)
    return null
}
