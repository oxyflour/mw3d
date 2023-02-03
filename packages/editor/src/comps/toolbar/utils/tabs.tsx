import { CSSProperties, ReactElement, useState } from "react"

export function Tabs({ initActive, style, className, children = [] }: {
    initActive?: string
    className?: string
    style?: CSSProperties
    children?: (ReactElement | undefined)[]
}) {
    const list = children.filter(item => item).map(item => item!),
        keys = list.map(item => (item.props.key || item.props.title).toString()),
        [active, setActive] = useState(initActive || keys[0] || '')
    return <div className={ `${className || ''} tabs flex flex-col` } style={ style }>
        <div className="titles flex flex-nowrap">
        {
            list.map((item, idx) => <div key={ idx }
                onClick={ () => setActive(keys[idx]) }
                className={ `title cursor-pointer ${active === keys[idx] ? 'active' : ''}` }>
                { item.props.key || item.props.title }
            </div>)
        }
        </div>
        {
            list
                .filter(item => (item.props.key || item.props.title).toString() === active)
                .map((item, idx) => <div className="tab grow flex" key={ idx }>
                    { item.props.children }
                </div>)
        }
    </div>
}
