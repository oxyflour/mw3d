import { CSSProperties, ReactElement, useState } from 'react'
import { GoAlert } from 'react-icons/go'
import lambda from '../../lambda'
import { upload } from '../../utils/dom/upload'
import Dropdown from '../utils/dropdown'
import { Menu, MenuGroup, MenuItem } from '../utils/menu'
import './index.less'

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

function Tabs({ initActive, style, className, children = [] }: {
    initActive?: string
    className?: string
    style?: CSSProperties
    children?: ReactElement[]
}) {
    const keys = children.map(item => (item.props.key || item.props.title).toString()),
        [active, setActive] = useState(initActive || keys[0] || '')
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
    return <Tabs initActive="Home" className={ `toolbar ${className || ''}` }>
        <div title="File">
            <Group title="Home">
                <ImageButton title="open"
                    onClick={
                        () => upload(async files => {
                            const arr = files ? Array.from(files) : []
                            for await (const msg of lambda.open(arr)) {
                                console.log(msg)
                            }
                            console.log('done')
                        })
                    } />
            </Group>
        </div>
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
