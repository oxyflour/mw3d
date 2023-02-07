import { ViewOpts } from "../../../utils/data/view"
import { Menu, MenuGroup, MenuItem } from "../../utils/menu"
import { Group } from "../utils/group"
import { IconButton } from "../utils/icon-button"
import { ImageButton } from "../utils/image-button"

export default ({ view, updateView }: {
    view: ViewOpts
    updateView: <K extends keyof ViewOpts>(key: K, val: Partial<ViewOpts[K]>) => void
}) => {
    // WIP
    view
    updateView
    return <>
        <Group title="Clipboard">
            <ImageButton title="Paste" />
            <div>
                <IconButton title="Delete" />
                <IconButton title="Copy" />
                <IconButton title="Copy View" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>Copy View</MenuItem>
                            <MenuItem>Properties...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
            </div>
        </Group>
        <Group title="Settings">
            <ImageButton title="Units" />
        </Group>
        <Group title="Simulation">
            <ImageButton title={ <span>Simulation<br/>Project</span> } />
            <ImageButton title={ <span>Setup<br/>Solver</span> } />
            <ImageButton title={ <span>Start<br/>Simulation</span> } />
            <div>
                <IconButton title="Optimizer" />
                <IconButton title="Par. Sweep" />
                <IconButton title="Logfile" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
            </div>
        </Group>
        <Group title="Mesh">
            <ImageButton title={ <span>Mesh<br />View</span> } />
            <ImageButton title={ <span>Global<br />Properties</span> } menu={
                <Menu>
                    <MenuGroup>
                        <MenuItem>...</MenuItem>
                    </MenuGroup>
                </Menu>
            } />
        </Group>
        <Group title="Edit">
            <ImageButton title={ <span>Properties</span> } />
            <ImageButton title={ <span>History<br />History</span> } />
            <ImageButton title={ <span>Calculator</span> } />
            <ImageButton title={ <span>Parametric<br />Update</span> } />
            <div>
                <IconButton title="Parameters" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
                <IconButton title="Problem Type" menu={
                    <Menu>
                        <MenuGroup>
                            <MenuItem>...</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
                <IconButton title="Information" />
            </div>
        </Group>
        <Group title="Macros">
            <ImageButton title="Macros" menu={
                <Menu>
                    <MenuGroup>
                        <MenuItem>...</MenuItem>
                    </MenuGroup>
                </Menu>
            } />
        </Group>
    </>
}
