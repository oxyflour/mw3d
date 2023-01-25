import { CSSProperties, ReactElement, useState } from 'react'
import { GoAlert } from 'react-icons/go'
import { mat4, vec3 } from 'gl-matrix'

import lambda from '../../lambda'
import Dropdown from '../utils/dropdown'
import { Entity } from '../../utils/data/entity'
import { upload } from '../../utils/dom/upload'
import { Menu, MenuGroup, MenuItem } from '../utils/menu'
import './index.less'
import { ViewOpts } from '../../utils/data/view'
import { Modal } from '../utils/Modal'
import { CgSpinnerTwo } from 'react-icons/cg'

const m = mat4.create(),
    v = vec3.create()
function randomPosition(size: number) {
    vec3.set(v, (Math.random() - 0.5) * size, (Math.random() - 0.5) * size, (Math.random() - 0.5) * size)
    mat4.fromTranslation(m, v)
    return Array.from(m)
}

export function ImageButton({ active, icon, title, onClick, menu }: {
    active?: boolean
    icon?: any
    title?: string | JSX.Element
    onClick?: () => void
    menu?: any
}) {
    return menu ?
    <div className={ "icon-button flex flex-col cursor-pointer " + (active ? 'active' : '') }>
        <div className="button text-center">
            { icon || <GoAlert size={ 32 } style={{ margin: 4, display: 'inline' }} /> }
        </div>
        <Dropdown menu={ menu } className="title button text-center grow">
            { title } ▼
        </Dropdown>
    </div> :
    <div className={ "icon-button button flex flex-col cursor-pointer " + (active ? 'active' : '') } onClick={ onClick }>
        <div className="text-center">
            { icon || <GoAlert size={ 32 } style={{ margin: 4, display: 'inline' }} /> }
        </div>
        <div className="title text-center">
            { title }
        </div>
    </div>
}

export function IconButton({ active, icon, title, onClick, menu }: {
    active?: boolean
    icon?: any
    title?: string | JSX.Element
    onClick?: () => void
    menu?: any
}) {
    return menu ?
    <div className={ "icon-button flex cursor-pointer " + (active ? 'active' : '') } style={{ marginLeft: -4 }}>
        <div className="button title px-1 py-1">
            { icon || <GoAlert style={{ display: 'inline' }} /> } { title } 
        </div>
        <Dropdown className="button title py-1" menu={ menu }>
            ▼
        </Dropdown>
    </div> :
    <div className={ "icon-button button flex cursor-pointer px-1 py-1 " + (active ? 'active' : '') } onClick={ onClick }>
        <div className="button title">
            { icon || <GoAlert style={{ display: 'inline' }} /> } { title }
        </div>
    </div>
}

export function Group({ title, children }: {
    title: string
    children?: any
}) {
    return <div className="group flex flex-nowrap flex-col">
        <div className="content flex grow">
            { children }
        </div>
        <div className="title text-center">{ title }</div>
    </div>
}

function Tabs({ initActive, style, className, children = [] }: {
    initActive?: string
    className?: string
    style?: CSSProperties
    children?: ReactElement[]
}) {
    const keys = children.map(item => (item.props.key || item.props.title).toString()),
        [active, setActive] = useState(initActive || keys[0] || '')
    return <div className={ `${className || ''} tabs flex flex-col` } style={ style }>
        <div className="titles flex flex-nowrap">
        {
            children.map((item, idx) => <div key={ idx }
                onClick={ () => setActive(keys[idx]) }
                className={ `title cursor-pointer ${active === keys[idx] ? 'active' : ''}` }>
                { item.props.key || item.props.title }
            </div>)
        }
        </div>
        {
            children
                .filter(item => (item.props.key || item.props.title).toString() === active)
                .map((item, idx) => <div className="tab grow flex" key={ idx }>
                    { item.props.children }
                </div>)
        }
    </div>
}

export function OpenFile({ ents, setEnts }: { ents: Entity[], setEnts: (ents: Entity[]) => void }) {
    const [opening, setOpening] = useState(''),
        [logs, setLogs] = useState([] as string[])
    return <>
        {
            opening && <Modal title={ <><CgSpinnerTwo className="icon-spin inline" /> Opening {opening}</> }>
                <pre style={{ maxHeight: 300, overflow: 'hidden' }}>{ logs.join('\n') }</pre>
            </Modal>
        }
        <ImageButton title="open"
            onClick={
                () => upload(async files => {
                    setOpening(Array.from(files || []).map(item => item.name).join(', '))
                    try {
                        const arr = files ? Array.from(files) : [],
                            ret = ents.slice(),
                            logs = [] as string[]
                        for await (const { entities, message } of lambda.shape.open(arr)) {
                            entities && ret.push(...entities)
                            if (message) {
                                logs.push(message)
                                setLogs(logs.slice())
                            }
                        }
                        setEnts(ret)
                    } catch (err) {
                        // TODO
                        console.error(err)
                    }
                    setOpening('')
                })
            } />
    </>
}

export default ({ className, ents, view, setEnts, setView }: {
    className?: string
    ents: Entity[]
    view: ViewOpts
    setEnts: (ents: Entity[]) => void
    setView: (view: ViewOpts) => void
}) => {
    function updateView<K extends keyof ViewOpts>(key: K, val: Partial<ViewOpts[K]>) {
        setView({ ...view, [key]: { ...view[key], ...val } })
    }
    return <Tabs initActive="Home" className={ `toolbar ${className || ''}` }>
        <div title="File">
            <Group title="Home">
                <OpenFile { ...{ ents, setEnts } } />
                <ImageButton title="generate"
                    onClick={
                        () => {
                            setEnts(ents.concat(Array(20).fill(0).map(() => {
                                return {
                                    attrs: { $n: `b/c${Math.floor(Math.random() * 10)}/d${Math.floor(Math.random() * 10)}` },
                                    bound: [-1, -1, -1, 1, 1, 1],
                                    trans: randomPosition(10),
                                }
                            })))
                        }
                    } />
            </Group>
        </div>
        <div title="Home">
            <Group title="Home">
                <ImageButton title={
                    view.pick?.mode ? `Picking ${view.pick.mode}` : 'Pick ...'
                } menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem onClick={ () => updateView('pick', { mode: 'face' }) }>Face</MenuItem>
                            <MenuItem onClick={ () => updateView('pick', { mode: 'edge' }) }>Edge</MenuItem>
                            <MenuItem onClick={ () => updateView('pick', { mode: 'vert' }) }>Vertex</MenuItem>
                            <MenuItem onClick={ () => updateView('pick', { mode: undefined }) }>None</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
                <ImageButton title={ <span>good <br /> xxx</span> } />
            </Group>
            <Group title="Tool">
                <ImageButton title="xx" />
                <div>
                    <IconButton title="button" />
                    <IconButton title="dropdown" menu={
                        <Menu>
                            <MenuGroup>
                                <MenuItem onClick={ () => console.log('ok') }>OK</MenuItem>
                                <MenuItem>Cancel</MenuItem>
                            </MenuGroup>
                            <MenuGroup>
                                <MenuItem onClick={ () => console.log('ok') }>OK</MenuItem>
                                <MenuItem>Cancel</MenuItem>
                            </MenuGroup>
                        </Menu>
                    } />
                </div>
            </Group>
        </div>
        <div title="Modeling">
            <Group title="Tool">
                <ImageButton title="xx" />
            </Group>
        </div>
        <div title="View">
            <Group title="Mouse Control">
                <ImageButton title="Zoom"
                    active={ view.mouseControl?.mode === 'zoom' }
                    onClick={ () => updateView('mouseControl', { mode: 'zoom' }) } />
                <ImageButton title="Pan"
                    active={ view.mouseControl?.mode === 'pan' }
                    onClick={ () => updateView('mouseControl', { mode: 'pan' }) } />
                <div>
                    <IconButton title="Rotate"
                        active={ !view.mouseControl?.mode }
                        onClick={ () => updateView('mouseControl', { mode: undefined }) } />
                </div>
            </Group>
            <Group title="Change View">
                <ImageButton title={ <span>Reset<br />View</span> } />
            </Group>
            <Group title="Sectional View">
                <ImageButton title={ <span>Cutting<br />Plane</span> }
                    active={ view.clipPlane?.enabled }
                    onClick={ () => updateView('clipPlane', { enabled: !view.clipPlane?.enabled }) } />
                <div>
                    <IconButton icon={ null } title={
                        <span>
                            Normal <select value={ view.clipPlane?.dir }
                                onChange={ evt => updateView('clipPlane', { dir: evt.target.value as any }) }>
                                <option value="+x">+x</option>
                                <option value="+y">+y</option>
                                <option value="+z">+z</option>
                                <option value="-x">-x</option>
                                <option value="-y">-y</option>
                                <option value="-z">-z</option>
                            </select>
                        </span>
                    } />
                    <IconButton icon={ null } title={
                        <span>
                            Position <input value={ view.clipPlane?.posText }
                                onChange={
                                    evt => updateView('clipPlane', {
                                        pos: parseFloat(evt.target.value) || 0,
                                        posText: evt.target.value,
                                    })
                                } />
                        </span>
                    } />
                </div>
            </Group>
        </div>
    </Tabs>
}
