import { ViewOpts } from "../../../utils/data/view"
import { Menu, MenuGroup, MenuItem } from "../../utils/menu"
import { Group } from "../utils/group"
import { IconButton } from "../utils/icon-button"
import { ImageButton } from "../utils/image-button"

export default ({ view, updateView }: {
    view: ViewOpts
    updateView: <K extends keyof ViewOpts>(key: K, val: Partial<ViewOpts[K]>) => void
}) => {
    return <>
        <Group title="Home">
            <ImageButton title={
                view.pick?.mode ? `Picking ${view.pick.mode}` : 'Pick ...'
            } menu={
                <Menu>
                    <MenuGroup>
                        <MenuItem onClick={ () => updateView('pick', { mode: 'face' }) }>Face</MenuItem>
                        <MenuItem onClick={ () => updateView('pick', { mode: 'edge' }) }>Edge</MenuItem>
                        <MenuItem onClick={ () => updateView('pick', { mode: 'vert' }) }>Vertex</MenuItem>
                        <MenuItem onClick={ () => updateView('pick', { mode: undefined }) }>None</MenuItem>
                    </MenuGroup>
                </Menu>
            } />
            <ImageButton title={ <span>good <br /> xxx</span> } />
        </Group>
        <Group title="Tool">
            <ImageButton title="xx" />
            <div>
                <IconButton title="button" />
                <IconButton title="dropdown" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem onClick={ () => console.log('ok') }>OK</MenuItem>
                            <MenuItem>Cancel</MenuItem>
                        </MenuGroup>
                        <MenuGroup>
                            <MenuItem onClick={ () => console.log('ok') }>OK</MenuItem>
                            <MenuItem>Cancel</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
            </div>
        </Group>
    </>
}
