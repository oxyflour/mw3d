import { ImageButton } from '../utils/image-button'
import { Group } from '../utils/group'
import { IconButton } from '../utils/icon-button'
import { ViewOpts } from '../../../utils/data/view'

export default ({ view, updateView }: {
    view: ViewOpts
    updateView: <K extends keyof ViewOpts>(key: K, val: Partial<ViewOpts[K]>) => void
}) => {
    return <>
        <Group title="Mouse Control">
            <ImageButton title="Zoom"
                active={ view.mouseControl?.mode === 'zoom' }
                onClick={ () => updateView('mouseControl', { mode: 'zoom' }) } />
            <ImageButton title="Pan"
                active={ view.mouseControl?.mode === 'pan' }
                onClick={ () => updateView('mouseControl', { mode: 'pan' }) } />
            <div>
                <IconButton title="Rotate"
                    active={ !view.mouseControl?.mode }
                    onClick={ () => updateView('mouseControl', { mode: undefined }) } />
            </div>
        </Group>
        <Group title="Change View">
            <ImageButton title={ <span>Reset<br />View</span> } />
        </Group>
        <Group title="Sectional View">
            <ImageButton title={ <span>Cutting<br />Plane</span> }
                active={ view.clipPlane?.enabled }
                onClick={ () => updateView('clipPlane', { enabled: !view.clipPlane?.enabled }) } />
            <div>
                <IconButton title={
                    <>
                        Normal <select value={ view.clipPlane?.dir }
                            onChange={ evt => updateView('clipPlane', { dir: evt.target.value as any }) }>
                            <option value="+x">+x</option>
                            <option value="+y">+y</option>
                            <option value="+z">+z</option>
                            <option value="-x">-x</option>
                            <option value="-y">-y</option>
                            <option value="-z">-z</option>
                        </select>
                    </>
                } />
                <IconButton title={
                    <>
                        Position <input value={ view.clipPlane?.posText }
                            onChange={
                                evt => updateView('clipPlane', {
                                    pos: parseFloat(evt.target.value) || 0,
                                    posText: evt.target.value,
                                })
                            } />
                    </>
                } />
            </div>
        </Group>
    </>
}
