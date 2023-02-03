import { KeyMap } from "../dom/keys"
import { Entity } from "./entity"

export type ViewPickMode = 'face' | 'edge' | 'vert'

export interface ViewOpts {
    transform?: {
        entities?: Record<number, Entity>
        action?: 'translate' | 'rotate' | 'scale'
        x?: number
        xT?: string
        y?: number
        yT?: string
        z?: number
        zT?: string
    },
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
