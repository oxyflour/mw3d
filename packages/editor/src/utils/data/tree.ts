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

export function select(tree: TreeData, id?: string) {
    const value = { ...tree } as TreeData,
        selected = [] as string[]
    for (const [id, { selected }] of Object.entries(tree)) {
        if (selected) {
            value[id] = { ...value[id], selected: false }
        }
    }
    if (id) {
        walk(value, id, id => {
            value[id] = { ...value[id], selected: true }
            selected.push(id)
        })
    }
    for (const [id, { children = [] }] of Object.entries(tree)) {
        if (children.some(id => value[id]?.selected)) {
            value[id] = { ...value[id], open: true }
        }
    }
    return { ...value, $selected: { children: selected } }
}

export function search(tree: TreeData, filter: string) {
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
