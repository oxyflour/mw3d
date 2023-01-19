import { Engine, useCanvas, useFrame } from "@ttk/react"
import { useRef } from "react"
import { Entity } from "../../../utils/data/entity"
import { ViewOpts } from "../../../utils/data/view"
import { Obj3WithEntity, query } from "../pick/utils"

function arrayEqual(a: number[], b: number[]) {
    return a.length === b.length && a.every((v, i) => v === b[i])
}

const scene = new Engine.Scene()
export function Culling({ view, setView, frameCount = 60 }: { view: ViewOpts, setView: (view: ViewOpts) => void, frameCount?: number }) {
    const ctx = useCanvas(),
        counter = useRef(0)
    useFrame(async () => {
        if ((counter.current ++) % frameCount) {
            return
        }
        const objs = { } as Record<number, Engine.Obj3>,
            updateEntity = (entity: Entity, update: any) => Object.assign(entity.attrs || (entity.attrs = { }), update)
        scene.clear()
        for (const obj of ctx.scene || []) {
            const { entity, id } = obj as Obj3WithEntity
            if (entity) {
                scene.add(objs[id] = obj)
                updateEntity(entity, { $visible: false })
            }
        }
        const visibleMeshes = (await query({ ...ctx, scene })).sort()
        for (const obj of visibleMeshes.map(id => objs[id] as Obj3WithEntity).filter(obj => obj)) {
            obj.entity && updateEntity(obj.entity, { $visible: true })
        }
        if (!arrayEqual(visibleMeshes, view.viewPort?.visibleMeshes || [])) {
            setView({ ...view, viewPort: { ...view.viewPort, visibleMeshes } })
        }
    })
    return null
}
