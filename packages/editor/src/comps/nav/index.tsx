import { useState } from 'react'
import './index.less'

export interface TreeNode {
    open?: boolean
    selected?: boolean
    checked?: boolean
    title?: string
    children?: string[]
}

export type TreeData = Record<string, TreeNode>

export function walk(tree: TreeData, id: string, cb: (id: string, node: TreeNode) => void) {
    const node = tree[id]
    if (node) {
        cb(id, node)
        for (const child of node.children || []) {
            walk(tree, child, cb)
        }
    }
}

export function select(tree: TreeData, id: string) {
    const value = Object.fromEntries(Object.entries(tree)
            .filter(([, node]) => node.selected)
            .map(([id, node]) => [id, ({ ...node, selected: false })])),
        selected = [] as string[]
    walk(tree, id, id => {
        value[id] = { ...tree[id], selected: true }
        selected.push(id)
    })
    return { ...tree, ...value, $selected: { children: selected } }
}

export function Tree({ id = '', data, onChange }: {
    id?: string
    data: TreeData
    onChange: ((data: TreeData) => void) | undefined
}): JSX.Element | null {
    const node = data[id]
    function updateSelf(update: Partial<TreeNode>) {
        onChange?.({ ...data, [id]: { ...node, ...update } })
    }
    function updateChild(update: Partial<TreeNode>, value = { } as TreeData) {
        walk(data, id, id => value[id] = { ...data[id], ...update })
        onChange?.({ ...data, ...value })
    }
    function updateSelected() {
        onChange?.(select(data, id))
    }
    return !node ? null : <div className="tree">
        <button className="carpet"
            onClick={ () => updateSelf({ open: !node.open }) }>
                { (node.children?.length || 0) > 0 ? (node.open ? '▼' : '▶') : '-' }
            </button>
        <input className="check" type="checkbox" checked={ !!node.checked }
            onChange={ evt => updateChild({ checked: evt.target.checked }) } />
        <label className={ `${node.selected ? 'selected' : ''} title` }
            onClick={ () => updateSelected() }>
            { node.title || '<Empty>' }
        </label>
        {
            node.open && (node.children?.length || 0) > 0 && <div style={{ marginLeft: 16 }}>
            {
                node.children
                    ?.filter(id => data[id])
                    .map(id => <Tree
                        key={ id }
                        id={ id }
                        data={ data }
                        onChange={ onChange } />)
            }
            </div>
        }
    </div>
}

function filterTree(tree: TreeData, filter: string) {
    const parents = { } as Record<string, string[]>
    for (const [id, { children = [] }] of Object.entries(tree)) {
        for (const child of children) {
            const arr = parents[child] || (parents[child] = [])
            arr.push(id)
        }
    }
    const included = { } as Record<string, boolean>
    function addIncluded(id: string) {
        included[id] = true
        for (const parent of parents[id] || []) {
            addIncluded(parent)
        }
    }
    for (const [id, { title }] of Object.entries(tree)) {
        if (title?.includes(filter)) {
            addIncluded(id)
        }
    }
    return Object.fromEntries(Object.entries(tree).filter(([id]) => included[id]))
}

export default ({ tree, onChange }: {
    tree: TreeData
    onChange?: ((tree: TreeData) => void) | undefined
}) => {
    const [filter, setFilter] = useState({ search: '', tree }),
        { children = [] } = tree.$root || { }
    return <div className="nav flex flex-col h-full">
        <div className="header flex">
            <input className="filter w-full grow" value={ filter.search }
                placeholder="search"
                onChange={
                    evt => {
                        const data = filter.search ? filter.tree : tree
                        setFilter({
                            tree: data,
                            search: evt.target.value
                        })
                        onChange?.(evt.target.value ?
                            filterTree(data, evt.target.value) :
                            data)
                    }
                } />
            {
                filter.search && <button onClick={
                    () => {
                        setFilter({ tree: { }, search: '' })
                        onChange?.(filter.tree)
                    }
                }>clear</button>
            }
        </div>
        <div className="content grow">
        {
            children.map(id =>
                <Tree id={ id } key={ id } data={ tree } onChange={ onChange } />)
        }
        </div>
    </div>
}
