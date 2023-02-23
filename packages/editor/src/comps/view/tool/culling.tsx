import { Engine, useCanvas, useFrame } from "@ttk/react"
import { useRef } from "react"
import { Entity } from "../../../utils/data/entity"
import { Obj3WithEntity, query } from "../pick/utils"

function setEqual<T>(a: Set<T>, b: Set<T>) {
    return a.size === b.size && Array.from(a).every(i => b.has(i))
}

const scene = new Engine.Scene()
export function Culling({ visible, setVisible, frameCount = 60 }: {
    visible: Set<Entity>
    setVisible: (visible: Set<Entity>) => void
    frameCount?: number
}) {
    const ctx = useCanvas(),
        counter = useRef(0)
    useFrame(async () => {
        if ((counter.current ++) % frameCount) {
            return
        }
        scene.clear()

        const objs = { } as Record<number, Obj3WithEntity>
        for (const obj of ctx.scene || []) {
            const { entity, id } = obj as Obj3WithEntity
            entity && scene.add(objs[id] = obj)
        }

        const value = new Set<Entity>,
            { ids } = await query({ ...ctx, scene })
        for (const id of ids) {
            const { entity } = objs[id] || { }
            entity && value.add(entity)
        }

        if (!setEqual(value, visible)) {
            setVisible(value)
        }
    })
    return null
}
