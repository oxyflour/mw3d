import { DetailedHTMLProps, useEffect, useRef, useState } from "react"

export default function Dropdown({ menu, children, ...rest }: {
    menu?: any
    children?: any
} & DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>) {
    const [position, setPosition] = useState(null as null | { left?: number, top?: number, right?: number, bottom?: number }),
        ref = useRef<HTMLDivElement>(null)
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
