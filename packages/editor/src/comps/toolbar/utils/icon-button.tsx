import { CSSProperties } from "react"
import { GoAlert } from "react-icons/go"
import Dropdown from "../../utils/dropdown"

export function IconButton({ active, icon, title, onClick, style, menu }: {
    active?: boolean
    icon?: any
    title?: string | JSX.Element
    onClick?: () => void
    menu?: any
    style?: CSSProperties
}) {
    return menu ?
    <div className={ "icon-button flex cursor-pointer " + (active ? 'active' : '') }
        style={{ marginLeft: -4, ...style }}>
        <div className="button title px-1 py-1">
            { icon || <GoAlert style={{ display: 'inline' }} /> } { title } 
        </div>
        <Dropdown className="button title py-1" menu={ menu }>
            ▼
        </Dropdown>
    </div> :
    <div className={ "icon-button button flex cursor-pointer px-1 py-1 " + (active ? 'active' : '') }
        style={ style }
        onClick={ onClick }>
        <div className="button title">
            { icon || <GoAlert style={{ display: 'inline' }} /> } { title }
        </div>
    </div>
}
