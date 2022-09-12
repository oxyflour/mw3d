import { KeyMap } from "../dom/keys"

export interface ViewOpts {
    pick?: {
        mode?: 'solid' | 'face' | 'edge' | 'vertex'
    }
    config?: {
        keyMap?: KeyMap
    }
}
