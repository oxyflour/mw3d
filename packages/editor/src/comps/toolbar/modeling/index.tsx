import { Entity, TreeEnts } from "../../../utils/data/entity"
import { getTransformedEntities, ViewOpts } from "../../../utils/data/view"
import { Menu, MenuGroup, MenuItem } from "../../utils/menu"
import { OpenFile } from "../file"
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
        <Group title="Exchange">
            <OpenFile title="Import / Export" add={ true } { ...{ ents, setEnts, updateView } } />
        </Group>
        <Group title="Materials">
            <div>
                <IconButton title="Background" />
                <IconButton title="Material Library" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
                <IconButton title="New / Edit" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
            </div>
        </Group>
        <Group title="Shapes">
        </Group>
        <Group title="Tools">
            <ImageButton title="Transform"
                disabled={ Object.keys(tree.$selected?.children || { }).length == 0 }
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
        <Group title="Picks">
            <ImageButton title="Picks" menu={
                <Menu>
                    <MenuGroup>
                        <MenuItem onClick={ () => updateView('pick', { mode: 'face' }) }>Face</MenuItem>
                        <MenuItem onClick={ () => updateView('pick', { mode: 'edge' }) }>Edge</MenuItem>
                        <MenuItem onClick={ () => updateView('pick', { mode: 'vert' }) }>Vertex</MenuItem>
                        <MenuItem onClick={ () => updateView('pick', { mode: undefined }) }>None</MenuItem>
                    </MenuGroup>
                </Menu>
            } />
            <div>
                <IconButton title="Pick Points" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
                <IconButton title="Pick Lists" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
                <IconButton title="Clear Picks" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
            </div>
        </Group>
        <Group title="Edit">
            <ImageButton title="Properties" />
            <ImageButton title={ <>History<br />List</> } />
            <ImageButton title="Calculator" />
            <ImageButton title={ <>Parametric<br />Update</> } />
            <div>
                <IconButton title="Parameters" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
                <IconButton title="Rename / Change" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
                <IconButton title="Information" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
            </div>
        </Group>
        <Group title="WCS">
            <ImageButton title={ <>Local<br />WCS</> } />
            <div>
                <IconButton title="Transform WCS" />
                <IconButton title="Align WCS" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
                <IconButton title="Fix WCS" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
            </div>
        </Group>
        <Group title="Sectional View">
            <ImageButton title={ <>Cutting<br />Plane</> } />
            <div>
                <IconButton title="Normal" />
                <IconButton title="Position" />
            </div>
        </Group>
    </>
}
