export function Overlay({ children, style }: { children?: any, style?: React.CSSProperties }) {
    return <div style={{
        position: 'fixed',
        left: '0',
        top: '0',
        right: '0',
        bottom: '0',
        background: 'rgba(0, 0, 0, 0.5)',
        ...style,
    }}>{ children }</div>
}
