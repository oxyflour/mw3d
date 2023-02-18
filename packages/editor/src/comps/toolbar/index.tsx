import { Entity, TreeEnts } from '../../utils/data/entity'

import './index.less'
import { ViewOpts } from '../../utils/data/view'
import { Tabs } from './utils/tabs'
import File from './file'
import Home from './home'
import Modeling from './modeling'
import View from './view'

export default ({ className, ents, view, tree, setEnts, setView, children }: {
    className?: string
    ents: Entity[]
    view: ViewOpts
    tree: TreeEnts
    setEnts: (ents: Entity[]) => void
    setView: (view: ViewOpts) => void
    children?: any
}) => {
    function updateView<K extends keyof ViewOpts>(key: K, val?: Partial<ViewOpts[K]>) {
        val ? setView({ ...view, [key]: { ...view[key], ...val } }) : setView({ ...view, [key]: undefined })
    }
    return <Tabs initActive="Home" className={ `toolbar ${className || ''}` }>
        <div title="File">
            <File { ...{ ents, setEnts, updateView } } />
        </div>
        <div title="Home">
            <Home view={ view } updateView={ updateView } />
        </div>
        <div title="Modeling">
            <Modeling { ...{ ents, tree, view, updateView, setEnts } } />
        </div>
        <div title="View">
            <View view={ view } updateView={ updateView } />
        </div>
        { children }
    </Tabs>
}
