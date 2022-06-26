import { useState } from 'react'
import { check, search, select, TreeData, TreeNode } from '../../utils/data/tree'
import './index.less'

export function Tree({ id = '', data, onChange }: {
    id?: string
    data: TreeData
    onChange: ((data: TreeData) => void) | undefined
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
        <label className={ `${node.selected ? 'selected' : ''} title` }
            onClick={ () => onChange?.(select(data, [id])) }>
            { node.title || '<Empty>' }
        </label>
        {
            node.open && children.length > 0 && <div style={{ marginLeft: 16 }}>
            {
                children.filter(id => data[id])
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

export default ({ tree, onChange }: {
    tree: TreeData
    onChange?: ((tree: TreeData) => void) | undefined
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
                        onChange?.(evt.target.value ?
                            search(data, evt.target.value) :
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
            <Tree id="Components" data={ tree } onChange={ onChange } />
            <Tree id="Materials" data={ tree } onChange={ onChange } />
        </div>
    </div>
}
