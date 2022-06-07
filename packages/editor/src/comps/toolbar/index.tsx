import { CSSProperties, ReactElement, useEffect, useState } from 'react'
import { GoAlert } from 'react-icons/go'
import { Menu, MenuGroup, MenuItem } from '../utils/menu'
import './index.less'

export function IconButton({ icon, title, onClick, dropdown }: {
    icon?: any
    title?: string | JSX.Element
    onClick?: () => void
    dropdown?: any
}) {
    const [visible, setVisible] = useState(false)
    useEffect(() => {
        const onClick = () => setVisible(false)
        document.body.addEventListener('click', onClick, true)
        return () => {
            document.body.removeEventListener('click', onClick)
        }
    }, [])
    return dropdown ?
    <div className="icon-button flex flex-col cursor-pointer">
        <div className="button text-center">
            { icon || <GoAlert size={ 32 } style={{ margin: 4, display: 'inline' }} /> }
        </div>
        <div className="title button text-center grow"
            tabIndex={ -1 }
            onClick={ () => setVisible(true) }>
            { title } ▼
        </div>
        {
            visible && <div>
                <div className="absolute" style={{ marginTop: -8 }}>{ dropdown }</div>
            </div>
        }
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
                <IconButton title="ok" dropdown={
                    <Menu>
                        <MenuGroup>
                            <MenuItem onClick={ () => console.log('ok') }>OK</MenuItem>
                            <MenuItem>Cancel</MenuItem>
                        </MenuGroup>
                    </Menu>
                } />
                <IconButton title={ <span>good <br /> xxx</span> } />
            </Group>
            <Group title="Tool">
                <IconButton title="xx" />
            </Group>
        </div>
        <div title="Modeling">
            <Group title="Tool">
                <IconButton title="xx" />
            </Group>
        </div>
    </Tabs>
}
