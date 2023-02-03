import { Entity } from '../../utils/data/entity'

import './index.less'
import { ViewOpts } from '../../utils/data/view'
import { Tabs } from './utils/tabs'
import File from './file'
import Home from './home'
import Modeling from './modeling'
import View from './view'

export default ({ className, ents, view, setEnts, setView, children }: {
    className?: string
    ents: Entity[]
    view: ViewOpts
    setEnts: (ents: Entity[]) => void
    setView: (view: ViewOpts) => void
    children?: any
}) => {
    function updateView<K extends keyof ViewOpts>(key: K, val: Partial<ViewOpts[K]>) {
        setView({ ...view, [key]: { ...view[key], ...val } })
    }
    return <Tabs initActive="Home" className={ `toolbar ${className || ''}` }>
        <div title="File">
            <File ents={ ents } setEnts={ setEnts } />
        </div>
        <div title="Home">
            <Home view={ view } updateView={ updateView } />
        </div>
        <div title="Modeling">
            <Modeling />
        </div>
        <div title="View">
            <View view={ view } updateView={ updateView } />
        </div>
        { children }
    </Tabs>
}
