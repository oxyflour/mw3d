import { CSSProperties, DetailedHTMLProps, ReactElement, useEffect, useRef, useState } from 'react'
import { GoAlert } from 'react-icons/go'
import { Menu, MenuGroup, MenuItem } from '../utils/menu'
import './index.less'

export function Dropdown({ menu, children, ...rest }: {
    menu?: any
    children?: any
} & DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
    const [position, setPosition] = useState(null as null | { left?: number, top?: number, right?: number, bottom?: number }),
        ref = useRef<HTMLDivElement>()
    useEffect(() => {
        if (position) {
            function onClick(evt: MouseEvent) {
                if (ref.current !== evt.target) {
                    setTimeout(() => setPosition(null), 50)
                }
            }
            document.body.addEventListener('click', onClick, true)
            return () => document.body.removeEventListener('click', onClick)
        } else {
            return () => { }
        }
    }, [position])
    function toggle() {
        const div = ref.current
        if (div) {
            const { left, right } = div.getBoundingClientRect(),
                pos = { } as NonNullable<typeof position>
            if (innerWidth - right > 100 || left < innerWidth - right) {
                pos.left = 0
            } else {
                pos.right = 0
            }
            setPosition(pos)
        }
    }
    return <div { ...rest } style={{ ...rest.style, position: 'relative' }}
        tabIndex={ -1 }
        ref={ ref }
        onClick={ toggle }>
        { children }
        {
            position && <div className="absolute text-left" style={ position }>
                { menu }
            </div>
        }
    </div>
}

export function ImageButton({ icon, title, onClick, menu }: {
    icon?: any
    title?: string | JSX.Element
    onClick?: () => void
    menu?: any
}) {
    return menu ?
    <div className="icon-button flex flex-col cursor-pointer">
        <div className="button text-center">
            { icon || <GoAlert size={ 32 } style={{ margin: 4, display: 'inline' }} /> }
        </div>
        <Dropdown menu={ menu } className="title button text-center grow">
            { title } ▼
        </Dropdown>
    </div> :
    <div className="icon-button button flex flex-col cursor-pointer" onClick={ onClick }>
        <div className="text-center">
            { icon || <GoAlert size={ 32 } style={{ margin: 4, display: 'inline' }} /> }
        </div>
        <div className="title text-center">
            { title }
        </div>
    </div>
}

export function IconButton({ icon, title, onClick, menu }: {
    icon?: any
    title?: string | JSX.Element
    onClick?: () => void
    menu?: any
}) {
    return menu ?
    <div className="icon-button flex cursor-pointer">
        <div className="button title px-1 py-1">
            { icon || <GoAlert style={{ display: 'inline' }} /> } { title } 
        </div>
        <Dropdown className="button title py-1" menu={ menu }>
            ▼
        </Dropdown>
    </div> :
    <div className="icon-button button flex cursor-pointer px-1 py-1" onClick={ onClick }>
        <div className="button title">
            { icon || <GoAlert style={{ display: 'inline' }} /> } { title }
        </div>
    </div>
}

export function Group({ title, children }: {
    title: string
    children?: any
}) {
    return <div className="group flex flex-nowrap flex-col">
        <div className="content flex grow">
            { children }
        </div>
        <div className="title text-center">{ title }</div>
    </div>
}

function Tabs({ style, className, children }: {
    className?: string
    style?: CSSProperties
    children?: ReactElement[]
}) {
    const keys = children.map(item => (item.props.key || item.props.title).toString()),
        [active, setActive] = useState(keys[0] || '')
    return <div className={ `${className || ''} tabs flex flex-col` } style={ style }>
        <div className="titles flex flex-nowrap">
        {
            children.map((item, idx) => <div key={ idx }
                onClick={ () => setActive(keys[idx]) }
                className={ `title cursor-pointer ${active === keys[idx] ? 'active' : ''}` }>
                { item.props.key || item.props.title }
            </div>)
        }
        </div>
        {
            children
                .filter(item => (item.props.key || item.props.title).toString() === active)
                .map((item, idx) => <div className="tab grow flex" key={ idx }>
                    { item.props.children }
                </div>)
        }
    </div>
}

export default ({ className }: {
    className?: string
}) => {
    return <Tabs className={ `toolbar ${className || ''}` }>
        <div title="Home">
            <Group title="Home">
                <ImageButton title="ok" menu={
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
        </div>
        <div title="Modeling">
            <Group title="Tool">
                <ImageButton title="xx" />
            </Group>
        </div>
    </Tabs>
}
