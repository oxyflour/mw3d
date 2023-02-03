import React, { useState } from 'react'
import { check, search, select, TreeData, TreeNode } from '../../utils/data/tree'
import './index.less'

export function Tree({ id = '', data, onChange, onKeyDownOnNode }: {
    id?: string
    data: TreeData
    onChange?: (data: TreeData) => void
    onKeyDownOnNode?: (id: string, evt: React.KeyboardEvent) => void
}): JSX.Element | null {
    const node = data[id]
    function updateSelf(update: Partial<TreeNode>) {
        onChange?.({ ...data, [id]: { ...node, ...update } })
    }
    const children = Object.keys(node?.children || { })
    return !node ? null : <div className="tree">
        <button className="carpet"
            onClick={ () => updateSelf({ open: !node.open }) }>
                { children.length > 0 ? (node.open ? '▼' : '▶') : '-' }
            </button>
        <input className="check" type="checkbox" checked={ !!node.checked }
            onChange={ evt => onChange?.(check(data, id, evt.target.checked)) } />
        <label tabIndex={ -1 }
            onKeyDown={ evt => onKeyDownOnNode?.(id, evt) }
            className={ `${node.selected ? 'selected' : ''} title` }
            onClick={ () => onChange?.(select(data, [id])) }>
            { node.title || '<Empty>' }
        </label>
        {
            node.open && children.length > 0 && <div style={{ marginLeft: 16 }}>
            {
                children.filter(id => data[id])
                    .map(id => <Tree key={ id } { ...{ id, data, onChange, onKeyDownOnNode } } />)
            }
            </div>
        }
    </div>
}

export default ({ tree, setTree, children, onKeyDownOnNode }: {
    tree: TreeData
    setTree?: (tree: TreeData) => void
    children?: any
    onKeyDownOnNode?: (id: string, evt: React.KeyboardEvent) => void
}) => {
    const [filter, setFilter] = useState({ search: '', tree })
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
                        setTree?.(evt.target.value ?
                            search(data, evt.target.value) :
                            data)
                    }
                } />
            {
                filter.search && <button onClick={
                    () => {
                        setFilter({ tree: { }, search: '' })
                        setTree?.(filter.tree)
                    }
                }>clear</button>
            }
        </div>
        <div className="content grow">
            <Tree id="Components" data={ tree } onChange={ setTree } onKeyDownOnNode={ onKeyDownOnNode } />
            <Tree id="Materials" data={ tree } onChange={ setTree } onKeyDownOnNode={ onKeyDownOnNode } />
            { children }
        </div>
    </div>
}
