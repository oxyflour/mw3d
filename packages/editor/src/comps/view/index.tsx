import { Canvas, Control, Engine, Mesh, MeshDefault } from '@ttk/react'
import { TreeNode } from '../nav'

export interface Ent {
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

export type TreeEnts = Record<string, TreeNode & { entities?: Ent[] }>

type CompProp<T> = T extends (...args: [infer A]) => any ? A : never

const [r = 0, g = 0, b = 0] = MeshDefault.mat.prop.data,
    MAT_DIM = new Engine.BasicMaterial({ color: [r, g, b, 0.7] })
export function Entity({ data, active }: {
    data: Ent
    active: boolean
}) {
    const props = { } as CompProp<typeof Mesh>
    data.trans && (props.matrix = data.trans)
    !active && (props.mat = MAT_DIM)
    return <Mesh { ...props } />
}

export default ({ tree }: {
    tree: TreeEnts
}) => {
    const meshes = tree.$meshes?.children || [],
        selected = tree.$selected?.children || [],
        active = Object.fromEntries(selected.map(item => [item, true]))
    return <Canvas style={{ width: '100%', height: '100%' }}>
        {
            meshes.map((id, idx) =>
                tree[id]?.checked &&
                tree[id]?.entities?.map((ent, val) =>
                    <Entity key={ idx + val * meshes.length }
                        data={ ent } active={ !selected.length || !!active[id] } />))
        }
        <Control />
    </Canvas>
}
