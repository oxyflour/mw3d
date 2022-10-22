import { KeyMap } from "../dom/keys"
import { Entity } from "./entity"

export type ViewPickMode = 'solid' | 'face' | 'edge' | 'vertex'

export interface ViewOpts {
    pick?: {
        mode?: ViewPickMode
        topos?: {
            entity: Entity
            type: ViewPickMode
            index: number
        }[]
    }
    mats?: {
        [k: string]: {
            metal?: boolean
            rgb?: { r: number, g: number, b: number }
        }
    }
    config?: {
        keyMap?: KeyMap
    }
}
