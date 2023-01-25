import { Center } from './center'
import { Overlay } from './overlay'

export function Modal({ style, titleStyle, contentStyle, title, children }: {
    style?: React.CSSProperties
    titleStyle?: React.CSSProperties
    contentStyle?: React.CSSProperties
    title?: JSX.Element | string
    children?: any
}) {
    return <Overlay>
        <Center style={{ width: '100%', height: '100%', ...style }}>
            <div style={{ background: 'white', padding: 8 }}>
                <div style={{ fontWeight: 'bold', ...titleStyle }}>{ title }</div>
                <div style={{ margin: 8, ...contentStyle }}>{ children }</div>
            </div>
        </Center>
    </Overlay>
}
