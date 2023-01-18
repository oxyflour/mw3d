export function Center({ children, style }: { children?: any, style?: React.CSSProperties }) {
    return <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ...style,
     }}>{ children }</div>
}
