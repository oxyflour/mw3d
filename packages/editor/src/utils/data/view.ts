import { KeyMap } from "../dom/keys"
import { Entity } from "./entity"

export interface ViewOpts {
    pick?: {
        mode?: 'solid' | 'face' | 'edge' | 'vertex'
        faces?: {
            entity: Entity,
            index: number,
        }[]
        edges?: {
            entity: Entity,
            index: number,
        }[]
        vertices?: {
            entity: Entity,
            index: number,
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
