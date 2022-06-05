import { GoAlert } from 'react-icons/go'
import './index.less'

export function IconButton({ icon, title, onClick }: {
    icon?: any
    title?: string | JSX.Element
    onClick?: () => void
}) {
    return <div className="icon-button flex flex-col cursor-pointer rounded-lg bg-green-500"
            style={{ padding: 4, margin: 4 }}
            onClick={ onClick }>
        <div className="text-center">
            { icon || <GoAlert size={ 32 } style={{ margin: 4, display: 'inline' }} /> }
        </div>
        <div className="title text-center">
            { title }
        </div>
    </div>
}

export function Block({ title, children }: {
    title: string
    children?: any
}) {
    return <div className="tool-block flex flex-nowrap flex-col">
        <div className="content flex grow">
            { children }
        </div>
        <div className="title text-center">{ title }</div>
    </div>
}

export default ({ className }: {
    className?: string
}) => {
    return <div className={ `toolbar flex flex-nowrap bg-slate-400 ${className || ''}` } style={{ height: 120 }}>
        <Block title="Home">
            <IconButton title="ok" />
            <IconButton title={ <span>good <br /> xxx</span> } />
        </Block>
        <Block title="Tool">
            <IconButton title="xx" />
        </Block>
    </div>
}
