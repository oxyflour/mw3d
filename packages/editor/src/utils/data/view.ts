import { mat4, vec3 } from 'gl-matrix'

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

export function getTransformedEntities(view: ViewOpts, ents: Entity[]) {
    const mat = mat4.create(),
        { entities = { }, action = 'translate', x = 0, y = 0, z = 0 } = view.transform || { }
    if (action === 'translate') {
        mat4.fromTranslation(mat, vec3.fromValues(x, y, z))
    } else if (action === 'rotate') {
        mat4.rotateX(mat, mat, x)
        mat4.rotateY(mat, mat, y)
        mat4.rotateZ(mat, mat, z)
    } else if (action === 'scale') {
        mat4.fromScaling(mat, vec3.fromValues(x, y, z))
    }

    const ret = { } as Record<number, Entity>
    for (const idx in entities) {
        const data = ents[parseInt(idx)]
        if (data) {
            const trans = mat4.create()
            data.trans && mat4.copy(trans, data.trans as any)
            mat4.multiply(trans, trans, mat)
            ret[idx] = { ...data, trans: Array.from(trans) }
        }
    }
    return ret
}
