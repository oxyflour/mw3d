import { Engine, useCanvas, useTick } from "@ttk/react"
import { Entity } from "../../../utils/data/entity"
import { ViewOpts } from "../../../utils/data/view"
import { Obj3WithEntity, query } from "../pick/utils"

function arrayEqual(a: number[], b: number[]) {
    return a.length === b.length && a.every((v, i) => v === b[i])
}

export function Culling({ view, setView }: { view: ViewOpts, setView: (view: ViewOpts) => void }) {
    const ctx = useCanvas()
    useTick(async () => {
        const objs = { } as Record<number, Engine.Obj3>,
            updateEntity = (entity: Entity, update: any) => Object.assign(entity.attrs || (entity.attrs = { }), update)
        ctx.scene?.walk((obj: Obj3WithEntity) => {
            objs[obj.id] = obj
            obj.entity && updateEntity(obj.entity, { $visible: false })
        })
        const visibleMeshes = (await query(ctx)).sort()
        for (const obj of visibleMeshes.map(id => objs[id] as Obj3WithEntity).filter(obj => obj)) {
            obj.entity && updateEntity(obj.entity, { $visible: true })
        }
        if (!arrayEqual(visibleMeshes, view.viewPort?.visibleMeshes || [])) {
            setView({ ...view, viewPort: { ...view.viewPort, visibleMeshes } })
        }
    }, 1000)
    return null
}
