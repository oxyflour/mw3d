import { TreeNode } from "./tree"

export interface Entity {
    data?: string
    attrs?: {
        $n?: string
        $m?: string
    } & Record<string, any>
    bound?: [number, number, number, number, number, number]
    geom?: { url?: string }
    topo?: {
        faces?: { url?: string }
        edges?: { url?: string }
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

export function parse(ents: Entity[]) {
    const tree = { } as TreeEnts
    function add(path: string, idx: number, ent: Entity) {
        const split = path.split('/'),
            prefix = ['$root', ...Array(split.length).fill(0).map((_, i) => split.slice(0, i + 1).join('/'))]
        for (let i = 0; i < prefix.length - 1; i ++) {
            const dir = prefix[i]!,
                parent = tree[dir] || (tree[dir] = { checked: true, title: split[i - 1]! }),
                key = prefix[i + 1]!,
                node = tree[key] || (tree[key] = { checked: true, title: split[i]! })
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
        add('Components/' + $n, idx, ent)
        add('Materials/' + $m, idx, ent)
    }
    return tree
}
