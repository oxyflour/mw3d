import { KeyMap } from "../dom/keys"
import { Entity } from "./entity"

export type ViewPickMode = 'face' | 'edge' | 'vert'

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
    mouseControl?: {
        mode?: 'zoom' | 'pan'
    }
    config?: {
        keyMap?: KeyMap
    }
    clipPlane?: {
        enabled?: boolean
        dir?: '+x' | '-x' | '+y' | '-y' | '+z' | '-z'
        pos?: number
        posText?: string
    }
}
