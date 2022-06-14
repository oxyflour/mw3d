import { useState } from 'react'
import { search, select, TreeData, TreeNode, walk } from '../../utils/data/tree'
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
        {
            children.map(id =>
                <Tree id={ id } key={ id } data={ tree } onChange={ onChange } />)
        }
        </div>
    </div>
}
