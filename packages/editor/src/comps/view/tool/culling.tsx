import { Engine, useCanvas, useFrame } from "@ttk/react"
import { useRef } from "react"
import { Entity } from "../../../utils/data/entity"
import { Obj3WithEntity, query } from "../pick/utils"

function equal<T>(a: T[], b: T[]) {
    return a.length === b.length && a.every((_, i) => a[i] === b[i])
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

        const objs = { } as Record<number, Engine.Obj3>
        for (const obj of ctx.scene || []) {
            const { entity, id } = obj as Obj3WithEntity
            entity && scene.add(objs[id] = obj)
        }

        const value = new Set<Entity>
        for (const id of await query({ ...ctx, scene })) {
            const { entity } = objs[id] as Obj3WithEntity
            entity && value.add(entity)
        }

        if (!equal(Array.from(value), Array.from(visible))) {
            setVisible(value)
        }
    })
    return null
}
