import { useCanvas } from "@ttk/react"
import { useEffect, useRef } from "react"
import { ViewOpts } from "../../../utils/data/view"
import { KeyBinding, KeyMap } from "../../../utils/dom/keys"

export function KeyControl({ view, setView }: { view: ViewOpts, setView: (view: ViewOpts) => void }) {
    const { canvas } = useCanvas(),
        map = useRef({ } as KeyMap),
        updatePick = (pick: ViewOpts['pick']) => setView({ ...view, pick: { ...view.pick, ...pick } })
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
        'p': down => !down && updatePick({ mode: 'vert' }),
        'f': down => !down && updatePick({ mode: 'face' }),
        'e': down => !down && updatePick({ mode: 'edge' }),
        'd': down => !down && updatePick({ topos: [] }),
        'Escape': down => !down && updatePick({ mode: undefined }),
    } as KeyMap)
    return null
}

