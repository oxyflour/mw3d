import { Engine, useCanvas, useTick } from "@ttk/react"
import { Entity } from "../../../utils/data/entity"
import { ViewOpts } from "../../../utils/data/view"
import { Obj3WithEntity, query } from "../pick/utils"

function arrayEqual(a: number[], b: number[]) {
    return a.length === b.length && a.every((v, i) => v === b[i])
}

const scene = new Engine.Scene()
export function Culling({ view, setView }: { view: ViewOpts, setView: (view: ViewOpts) => void }) {
    const ctx = useCanvas()
    useTick(async () => {
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
    }, 1000)
    return null
}
