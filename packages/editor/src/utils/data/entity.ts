import { TreeNode } from "./tree"

export interface Entity {
    attrs?: {
        $n?: string
        $m?: string
    } & Record<string, any>
    trans?: number[]
    geom?: {
        faces?: string
        edges?: string
    }
}

export type TreeEntNode = TreeNode & {
    entities?: Entity[]
}

export type TreeEnts = Record<string, TreeEntNode> & {
    $root?: TreeEntNode
    $meshes?: TreeEntNode
    $selected?: TreeEntNode
}

export function parse(ents: Entity[]) {
    const meshes = { } as Record<string, boolean>,
        tree = { } as TreeEnts
    for (const ent of ents) {
        const { attrs = { } } = ent,
            { $n = '' } = attrs,
            split = $n.split('/')
        if (split.some(item => item.startsWith('$'))) {
            continue
        }

        const prefix = ['$root', ...Array(split.length).fill(0).map((_, i) => split.slice(0, i + 1).join('/'))]
        for (let i = 0; i < prefix.length - 1; i ++) {
            const dir = prefix[i]!,
                parent = tree[dir] || (tree[dir] = { checked: true, title: split[i - 1]! }),
                children = parent.children || (parent.children = []),
                key = prefix[i + 1]!,
                node = tree[key] || (children.push(key), (tree[key] = { checked: true, title: split[i]! }))
            if (i === split.length - 1) {
                const entities = node.entities || (node.entities = [])
                entities.push(ent)
                meshes[key] = true
            }
        }
    }
    tree.$meshes = { children: Object.keys(meshes) }
    return tree
}
