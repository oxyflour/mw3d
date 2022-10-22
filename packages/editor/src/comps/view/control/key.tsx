import { useCanvas } from "@ttk/react"
import { useEffect, useRef } from "react"
import { ViewOpts } from "../../../utils/data/view"
import { KeyBinding, KeyMap } from "../../../utils/dom/keys"

export function KeyControl({ view, setView }: { view: ViewOpts, setView: (view: ViewOpts) => void }) {
    const { canvas } = useCanvas(),
        map = useRef({ } as KeyMap)
    useEffect(() => {
        if (canvas) {
            const binding = new KeyBinding(canvas)
            binding.load(map.current)
            return () => binding.destroy()
        } else {
            return () => { }
        }
    }, [canvas])
    Object.assign(map.current, {
        'f': down => !down && setView({ ...view, pick: { ...view.pick, mode: 'face' } }),
        'e': down => !down && setView({ ...view, pick: { ...view.pick, mode: 'edge' } }),
        'Escape': down => !down && setView({ ...view, pick: { ...view.pick, mode: undefined } }),
    } as KeyMap)
    return null
}

