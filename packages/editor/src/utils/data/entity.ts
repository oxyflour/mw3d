import { TreeNode, walk } from "./tree"

export interface BufferData {
    url?: string
    offset?: number
    size?: number
}

export interface Entity {
    data?: BufferData
    attrs?: {
        $n?: string
        $m?: string
        $rgb?: { r: number, g: number, b: number }
        [k: string]: any
    }
    bound?: [number, number, number, number, number, number]
    geom?: BufferData
    topo?: {
        faces?: BufferData
        edges?: BufferData
        verts?: BufferData
    }
    trans?: number[]
    nodes?: string[]
}

export type TreeEntNode = TreeNode & {
    entities?: number[]
}

export type TreeEnts = Record<string, TreeEntNode> & {
    $root?: TreeEntNode
    $selected?: TreeEntNode
}

export function remove(ents: Entity[], tree: TreeEnts, ids: string[]) {
    const left = new Set(ents)
    for (const id of ids) {
        walk(tree, id, (_, { entities }: TreeEntNode) => {
            for (const idx of entities || []) {
                const ent = ents[idx]
                ent && left.delete(ent)
            }
        })
    }
    return ents.filter(ent => left.has(ent))
}

export function parse(ents: Entity[], prev: TreeEnts) {
    const tree = { } as TreeEnts
    function add(path: string, idx: number, ent: Entity) {
        const split = path.split('/'),
            prefix = ['$root', ...Array(split.length).fill(0).map((_, i) => split.slice(0, i + 1).join('/'))]
        for (let i = 0; i < prefix.length - 1; i ++) {
            const dir = prefix[i]!,
                parent = tree[dir] || (tree[dir] = { checked: true, title: split[i - 1]!, open: prev[dir]?.open }),
                key = prefix[i + 1]!,
                node = tree[key] || (tree[key] = { checked: true, title: split[i]!, open: prev[key]?.open })
            Object.assign(parent.children || (parent.children = { }), { [key]: true })
            Object.assign(node.parents || (node.parents = { }), { [dir]: true })
            if (i === split.length - 1) {
                const entities = node.entities || (node.entities = [])
                entities.push(idx)
                const nodes = ent.nodes || (ent.nodes = [])
                nodes.push(key)
            }
        }
    }
    for (const [idx, ent] of ents.entries()) {
        const { attrs = { } } = ent,
            { $n = 'default', $m = 'default' } = attrs,
            split = $n.split('/')
        if (split.some(item => item.startsWith('$'))) {
            continue
        }
        ent.nodes = []
        add('Components/' + $n, idx, ent)
        add('Materials/' + $m, idx, ent)
    }
    return tree
}
