import './menu.less'

export function MenuItem({ children, onClick }: { children?: any, onClick?: (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void }) {
    return <a
        className="menu-item text-gray-700 block px-4 py-2 text-sm"
        role="menuitem"
        tabIndex={ -1 }
        onClick={ onClick }>
        { children }
    </a>
}

export function MenuGroup({ children }: { children?: any }) {
    return <div className="menu-group" role="none">
        { children }
    </div>
}

export function Menu({ children }: { children?: any }) {
    return <div className="menu mt-2 w-56 rounded-sm shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none" role="menu" aria-orientation="vertical" aria-labelledby="menu-button" tabIndex={ -1 }>
        { children }
    </div>
}
