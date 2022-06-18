import { withMouseDown } from "../../utils/dom/mouse"
import { useSavedInt } from "../../utils/react/hooks"

const clamp = (min: number, val: number, max: number) => Math.max(Math.min(max, val), min)

export default ({ className, children }: {
    className?: string
    children: any[]
}) => {
    const [width, setTreeWidth] = useSavedInt('saved-nav-width', 180)
    function onResize(evt: React.MouseEvent) {
        const startX = evt.clientX - width
        withMouseDown(({ clientX }) => setTreeWidth(clamp(100, clientX - startX, innerWidth - 100)))
    }
    return <div className={ `flex ${className || ''}` }>
        <div style={{ width }}>
            { children[0] }
        </div>
        <div className="bg-gray-200 select-none cursor-col-resize"
            style={{ width: 3 }}
            onMouseDown={ onResize }>
        </div>
        <div style={{ width: `calc(100% - ${width + 5}px)` }}>
            { children[1] }
        </div>
    </div>
}
