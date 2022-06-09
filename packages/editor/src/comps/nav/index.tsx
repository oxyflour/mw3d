import { useEffect, useState } from 'react'
import './index.less'

export interface TreeNode {
    open?: boolean
    selected?: boolean
    checked?: boolean
    title?: string
    children?: string[]
    entities?: { }[]
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

export function Tree({ id = '', data, onChange }: {
    id?: string
    data: TreeData
    onChange?: (data: TreeData) => void
}): JSX.Element {
    const node = data[id] || { },
        update = (update: Partial<TreeNode>) => onChange?.({ ...data, [id]: { ...node, ...update } })
    return <div className="tree">
        <button className="carpet"
            onClick={ () => update({ open: !node.open }) }>
                { node.children?.length > 0 ? (node.open ? '▼' : '▶') : '-' }
            </button>
        <input className="check" type="checkbox" checked={ !!node.checked }
            onChange={ evt => update({ checked: evt.target.checked }) } />
        <label className={ `${node.selected ? 'selected' : ''} title` }
            onClick={ () => update({ selected: !node.selected }) }>
            { node.title || 'Root' }
        </label>
        {
            node.open && node.children?.length > 0 && <div style={{ marginLeft: 16 }}>
            {
                node.children
                    .filter(id => data[id])
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
    const parents = { } as Record<string, string>,
        included = { '': true } as Record<string, boolean>
    for (const [id, { children = [] }] of Object.entries(tree)) {
        for (const child of children) {
            parents[child] = id
        }
    }
    for (const [id, { title }] of Object.entries(tree)) {
        if (title.includes(filter)) {
            let item = id
            do {
                included[item] = true
            } while (item = parents[item])
        }
    }
    return Object.fromEntries(Object.entries(tree).filter(([id]) => included[id]))
}

export default ({ tree }: {
    tree: TreeData
}) => {
    const [filter, setFilter] = useState(''),
        [data, setData] = useState(tree)
    useEffect(() => setData(filterTree(tree, filter)), [tree, filter])
    return <div className="nav flex flex-col h-full">
        <div className="header flex">
            <input className="filter w-full grow" value={ filter }
                placeholder="search"
                onChange={ evt => setFilter(evt.target.value) } />
            {
                filter && <button onClick={ () => setFilter('') }>clear</button>
            }
        </div>
        <div className="content grow">
        {
            data['']?.children.map(id =>
                <Tree key={ id } id={ id } data={ data } onChange={ setData } />)
        }
        </div>
    </div>
}
