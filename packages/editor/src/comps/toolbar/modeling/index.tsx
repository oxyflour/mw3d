import { Entity, TreeEnts } from "../../../utils/data/entity"
import { getTransformedEntities, ViewOpts } from "../../../utils/data/view"
import { Group } from "../utils/group"
import { IconButton } from "../utils/icon-button"
import { ImageButton } from "../utils/image-button"

function initTransform(tree: TreeEnts, ents: Entity[]) {
    const entities = { } as Record<number, Entity>
    for (const key in tree.$selected?.children || { }) {
        for (const idx of tree[key]?.entities || []) {
            const ent = ents[idx]
            if (ent) {
                entities[idx] = ent
            }
        }
    }
    return Object.keys(entities).length ? { entities } : undefined
}

export default ({ view, tree, ents, updateView, setEnts }: {
    view: ViewOpts
    tree: TreeEnts
    ents: Entity[]
    updateView: <K extends keyof ViewOpts>(key: K, val?: Partial<ViewOpts[K]>) => void
    setEnts: (ents: Entity[]) => void
}) => {
    function applyTransform() {
        updateView('transform')
        const map = getTransformedEntities(view, ents)
        setEnts(ents.map((ent, idx) => map[idx] || ent))
    }
    return <>
        <Group title="Tool">
            <ImageButton title="Transform"
                active={ !!view.transform }
                onClick={ () => updateView('transform', view.transform ? undefined : initTransform(tree, ents)) } />
            {
                view.transform && <div>
                    <IconButton title={
                        <>
                        Action <select value={ view.transform.action } style={{ width: 120 }}
                            onChange={
                                evt => updateView('transform', {
                                    ...view.transform,
                                    action: evt.target.value as typeof view.transform.action
                                })
                            }>
                            <option value="translate">translate</option>
                            <option value="rotate">rotate</option>
                            <option value="scale">scale</option>
                        </select>
                        </>
                    } />
                    <IconButton title={
                        <>
                            <span> X </span>
                            <input value={ view.transform.xT } style={{ width: 40 }}
                                onChange={
                                    evt => updateView('transform', {
                                        ...view.transform,
                                        x: parseFloat(evt.target.value),
                                        xT: evt.target.value,
                                    })
                                } />
                            <span> Y </span>
                            <input value={ view.transform.yT } style={{ width: 40 }}
                                onChange={
                                    evt => updateView('transform', {
                                        ...view.transform,
                                        y: parseFloat(evt.target.value),
                                        yT: evt.target.value,
                                    })
                                } />
                            <span> Z </span>
                            <input value={ view.transform.zT } style={{ width: 40 }}
                                onChange={
                                    evt => updateView('transform', {
                                        ...view.transform,
                                        z: parseFloat(evt.target.value),
                                        zT: evt.target.value,
                                    })
                                } />
                        </>
                    } />
                    <IconButton style={{ width: 90, display: 'inline-block' }} title={
                        <span>OK</span>
                    } onClick={
                        () => applyTransform()
                    } />
                    <IconButton style={{ width: 90, display: 'inline-block' }} title={
                        <span>Cancel</span>
                    } onClick={
                        () => updateView('transform')
                    } />
                </div>
            }
        </Group>
    </>
}
