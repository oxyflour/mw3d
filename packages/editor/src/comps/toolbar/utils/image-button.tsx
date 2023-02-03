import { GoAlert } from "react-icons/go"
import Dropdown from "../../utils/dropdown"

export function ImageButton({ active, icon, title, onClick, menu }: {
    active?: boolean
    icon?: any
    title?: string | JSX.Element
    onClick?: () => void
    menu?: any
}) {
    return menu ?
    <div className={ "icon-button flex flex-col cursor-pointer " + (active ? 'active' : '') }>
        <div className="button text-center">
            { icon || <GoAlert size={ 32 } style={{ margin: 4, display: 'inline' }} /> }
        </div>
        <Dropdown menu={ menu } className="title button text-center grow">
            { title } ▼
        </Dropdown>
    </div> :
    <div className={ "icon-button button flex flex-col cursor-pointer " + (active ? 'active' : '') } onClick={ onClick }>
        <div className="text-center">
            { icon || <GoAlert size={ 32 } style={{ margin: 4, display: 'inline' }} /> }
        </div>
        <div className="title text-center">
            { title }
        </div>
    </div>
}
