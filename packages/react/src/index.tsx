import React, { createContext, CSSProperties, MutableRefObject, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { Engine, Tool } from '@ttk/core'
import { mat4, quat } from 'gl-matrix'

export { Engine, Tool, Utils } from '@ttk/core'

import Sender from './cast/sender'
import Receiver from './cast/receiver'

export interface CanvasContextValue {
    scene?: Engine.Scene
    camera?: Engine.PerspectiveCamera
    canvas?: HTMLCanvasElement
    frame?: {
        before: ((time: number) => void)[],
        after: ((time: number) => void)[],
    }
}

const CanvasContext = createContext({ } as CanvasContextValue)
export function useCanvas() {
    return useContext(CanvasContext)
}

export function useFrame(func: (time: number) => void, before = true) {
    const { frame } = useCanvas(),
        ref = useRef(func)
    ref.current = func
    useEffect(() => {
        if (frame) {
            const callback = (time: number) => ref.current(time)
            if (before) {
                frame.before.push(callback)
                return () => { frame.before = frame.before.filter(item => item !== callback) }
            } else {
                frame.after.push(callback)
                return () => { frame.after = frame.after.filter(item => item !== callback) }
            }
        } else {
            return () => { }
        }
    }, [frame])
}

export function useTick(func: (time: number) => void, interval = 100) {
    const { frame } = useCanvas(),
        ref = useRef(func)
    ref.current = func
    useEffect(() => {
        if (frame) {
            let current = -1
            function callback(time: number) {
                if (current < 0) {
                    current = time
                } else {
                    while (current < time) {
                        ref.current(current += interval)
                    }
                }
            }
            frame.before.push(callback)
            return () => { frame.before = frame.before.filter(item => item !== callback) }
        } else {
            return () => { }
        }
    }, [frame])
}

export function Canvas({ children, options, style, className, camera: initCamera }: {
    children: any
    options?: Engine.RendererOptions
    style?: CSSProperties
    className?: string
    camera?: Engine.PerspectiveCamera
}) {
    const [state, setState] = useState({ } as CanvasContextValue),
        [error, setError] = useState(null as any),
        cvRef = useRef<HTMLCanvasElement>(null)
    async function init(canvas: HTMLCanvasElement, handle: { running: boolean }) {
        try {
            const scene = new Engine.Scene(),
                container = canvas as any as { __renderer__: Promise<Engine.Renderer> },
                renderer = await (container.__renderer__ || (container.__renderer__ = Engine.Renderer.create(canvas, options))),
                camera = initCamera || new Engine.PerspectiveCamera({
                    fov: 2 / 180 * Math.PI,
                    position: [0, 0, 500],
                }),
                light = new Engine.Light({ position: [10, 20, 30] }),
                frame = { before: [], after: [] } as NonNullable<CanvasContextValue['frame']>
            camera.aspect = canvas.clientWidth / canvas.clientHeight
            scene.add(light)
            requestAnimationFrame(function render(time: number) {
                if (handle.running) {
                    requestAnimationFrame(render)
                    for (const func of frame.before) {
                        func(time)
                    }
                    renderer.render(scene, camera)
                    for (const func of frame.after) {
                        func(time)
                    }
                }
            })
            setState({ scene, camera, canvas, frame })
        } catch (err) {
            console.error(err)
            setError(err)
        }
    }
    useEffect(() => {
        const canvas = cvRef.current,
            handle = { running: true }
        canvas && init(canvas, handle)
        return () => { handle.running = false }
    }, [cvRef.current])
    useEffect(() => {
        if (cvRef.current && state.camera) {
            state.camera.aspect = cvRef.current.scrollWidth / cvRef.current.scrollHeight
        }
    }, [cvRef.current?.scrollWidth, cvRef.current?.scrollHeight])
    return <CanvasContext.Provider value={ state }>
        {
            error && <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
            }}>{ error?.message || `${error}` }</div>
        }
        <canvas ref={ cvRef } className={ className } style={ style } />
        { children }
    </CanvasContext.Provider>
}

type ClassArgs<A> = A extends new (...args: infer C) => any ? C : A
export type CtrlOpts = ClassArgs<typeof Tool.Control>['2']
export function Control({ ref, ...opts }: {
    ref?: MutableRefObject<Tool.Control>
} & CtrlOpts) {
    const { canvas, camera } = useCanvas(),
        [control, setControl] = useState<Tool.Control>()
    if (control?.opts) {
        control.opts.hooks = opts.hooks
    }
    useFrame(() => control?.update(), false)
    useEffect(() => {
        if (canvas && camera) {
            const control = new Tool.Control(canvas, camera, opts)
            ref && (ref.current = control)
            setControl(control)
            return () => { control.detach() }
        } else {
            return () => { }
        }
    }, [canvas, camera])
    return null
}

const Obj3Context = createContext({ } as { obj?: Engine.Obj3 })
export function useObj3() {
    return useContext(Obj3Context)
}

export function Obj3({ children, create, matrix, position, rotation, scaling }: {
    children?: any
    matrix?: number[] | mat4
    position?: [number, number, number]
    rotation?: [number, number, number]
    scaling?: [number, number, number]
    create?: () => Engine.Obj3
}) {
    const { scene } = useCanvas(),
        { obj: node } = useObj3(),
        obj = useMemo(() => create?.() || new Engine.Obj3(), [])
    useEffect(() => {
        if (scene && obj) {
            const parent = node || scene
            parent.add(obj)
            return () => { parent.delete(obj) }
        } else {
            return () => { }
        }
    }, [obj, scene])
    useEffect(() => {
        if (obj && position) {
            const [x, y, z] = position
            obj.position.set(x, y, z)
        }
        if (obj && rotation) {
            const [x, y, z] = rotation
            quat.set(obj.rotation.data, 0, 0, 0, 1)
            obj.rotation.rotX(x).rotY(y).rotZ(z)
        }
        if (obj && scaling) {
            const [x, y, z] = scaling
            obj.scaling.set(x, y, z)
        }
        if (obj && matrix) {
            mat4.copy(obj.worldMatrix, matrix as any)
            obj.setWorldMatrix(obj.worldMatrix)
        }
    }, [obj, matrix, position, rotation, scaling])
    return <Obj3Context.Provider value={{ obj }}>
        { children }
    </Obj3Context.Provider>
}

type Arg0<A> = A extends (...args: infer C) => any ? C[0] : A

function MeshSetter({ geo, mat, isVisible, renderOrder, offset, count }: {
    geo?: Engine.Geometry
    mat?: Engine.Material
    isVisible?: boolean
    renderOrder?: number
    offset?: number
    count?: number
}) {
    const { obj: mesh } = useObj3() as { obj: Engine.Mesh }
    if (mesh) {
        mesh.geo = geo
        mesh.mat = mat
        mesh.isVisible = isVisible !== undefined ? isVisible : true
        mesh.renderOrder = renderOrder || 0
        mesh.offset = offset || 0
        mesh.count = count || -1
    }
    return null
}
export function Mesh({ children, ...props }: Arg0<typeof MeshSetter> & Arg0<typeof Obj3>) {
    return <Obj3 create={ () => new Engine.Mesh() } { ...props }>
        <MeshSetter { ...props } />
        { children }
    </Obj3>
}

export { Sender, Receiver }
