export interface TreeNode {
    open?: boolean
    selected?: boolean
    checked?: boolean
    title?: string
    parents?: Record<string, true>
    children?: Record<string, true>
}

export type TreeData = Record<string, TreeNode>

export function walk(tree: TreeData, id: string,
        cb: (id: string, node: TreeNode) => void,
        down = true,
        visited = { } as Record<string, boolean>) {
    const node = tree[id]
    if (node && !visited[id]) {
        visited[id] = true
        cb(id, node)
        for (const id in (down ? node.children : node.parents) || { }) {
            walk(tree, id, cb, down, visited)
        }
    }
}

export function check(tree: TreeData, id: string, checked: boolean) {
    const value = { } as TreeData,
        prefix = id.split('/').shift() || '',
        list = [{ id, checked }]
    for (const id in tree.$root?.children || { }) {
        if (id !== prefix) {
            list.push({ id, checked: true })
        }
    }
    for (const { id, checked } of list) {
        walk(tree, id, (id, node) => {
            if (node.checked !== checked) {
                value[id] = { ...tree[id], checked }
            }
        })
    }
    return { ...tree, ...value }
}

export function select(tree: TreeData, nodes?: string[]) {
    const value = { ...tree } as TreeData,
        selected = { } as Record<string, true>
    for (const [id, { selected }] of Object.entries(tree)) {
        if (selected) {
            value[id] = { ...value[id], selected: false }
        }
    }
    for (const id of nodes || []) {
        walk(value, id, id => {
            value[id] = { ...value[id], selected: true }
            selected[id] = true
        }, true)
        walk(value, id, id => {
            value[id] = { ...value[id], open: true }
        }, false)
    }
    return { ...value, $selected: { children: selected } }
}

export function search(tree: TreeData, filter: string) {
    const included = { } as Record<string, boolean>
    for (const [id, { title }] of Object.entries(tree)) {
        if (title?.includes(filter)) {
            walk(tree, id, id => included[id] = true, false)
        }
    }
    return Object.fromEntries(Object.entries(tree).filter(([id]) => included[id]))
}
