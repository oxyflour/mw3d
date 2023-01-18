import { Center } from './center'
import { Overlay } from './overlay'

export function Modal({ style, title, children }: {
    style?: React.CSSProperties
    title?: JSX.Element | string
    children?: any
}) {
    return <Overlay>
        <Center style={{ width: '100%', height: '100%', ...style }}>
            <div style={{ background: 'white', padding: 8 }}>
                <h2><b>{ title }</b></h2>
                <p>{ children }</p>
            </div>
        </Center>
    </Overlay>
}
