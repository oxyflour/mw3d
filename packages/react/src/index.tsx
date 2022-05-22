import React, { createContext, CSSProperties, MutableRefObject, useContext, useEffect, useRef, useState } from 'react'

import { Engine } from '@ttk/core'
import { mat4, quat } from 'gl-matrix'

interface CanvasContextValue {
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

export function Canvas({ children, options, style }: {
    children: any
    options?: (canvas: HTMLCanvasElement) => Engine.Renderer['opts']
    style?: CSSProperties
}) {
    const [state, setState] = useState({ } as CanvasContextValue),
        [error, setError] = useState(null as any),
        cvRef = useRef<HTMLCanvasElement>(null)
    async function init(canvas: HTMLCanvasElement, handle: { running: boolean }) {
        try {
            const scene = new Engine.Scene(),
                opts = options?.(canvas) || { },
                renderer = await Engine.Renderer.create(canvas, opts),
                camera = new Engine.PerspectiveCamera({
                    fov: 60 / 180 * Math.PI,
                    aspect: canvas.clientWidth / canvas.clientHeight,
                    near: 1,
                    far: 2000,
                }),
                light = new Engine.Light(),
                frame = { before: [], after: [] } as NonNullable<CanvasContextValue['frame']>
            camera.position.set(0, 0, 600)
            light.position.set(500, 500, 500)
            scene.add(light)
            requestAnimationFrame(function render(time: number) {
                if (handle.running) {
                    for (const func of frame.before) {
                        func(time)
                    }
                    requestAnimationFrame(render)
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
        console.log('init', handle)
        return () => {
            handle.running = false
            console.log('init', handle)
        }
    }, [cvRef.current])
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
        <canvas ref={ cvRef } style={ style } />
        { children }
    </CanvasContext.Provider>
}

export function Control({ ref }: { ref?: MutableRefObject<Engine.Control> }) {
    const { canvas, camera } = useCanvas()
    useEffect(() => {
        if (canvas && camera) {
            const control = new Engine.Control(canvas, camera)
            ref && (ref.current = control)
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
    matrix?: number[]
    position?: [number, number, number]
    rotation?: [number, number, number]
    scaling?: [number, number, number]
    create?: () => Engine.Obj3
}) {
    const { scene } = useCanvas(),
        { obj: node } = useObj3(),
        [obj, setObj] = useState(undefined as undefined | Engine.Obj3)
    useEffect(() => {
        setObj(create ? create() : new Engine.Obj3())
    }, [])
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

type Args<A> = A extends (...args: infer C) => any ? C : A

export const MeshDefault = {
    mat: new Engine.BasicMaterial({ metallic: 1, roughness: 0.5 }),
    geo: new Engine.SphereGeometry({ radius: 100 })
}
function MeshSetter({ geo, mat }: {
    geo?: Engine.Geometry
    mat?: Engine.Material
}) {
    const { obj: mesh } = useObj3() as { obj: Engine.Mesh }
    useEffect(() => {
        if (mesh) {
            mesh.geo = geo || MeshDefault.geo
            mesh.mat = mat || MeshDefault.mat
        }
    }, [mesh, geo, mat])
    return null
}
export function Mesh({ geo, mat, children, ...props }: {
    geo?: Engine.Geometry
    mat?: Engine.Material
} & Args<typeof Obj3>['0']) {
    return <Obj3 { ...props }
            create={ () => new Engine.Mesh(MeshDefault.geo, MeshDefault.mat) }>
        <MeshSetter geo={ geo } mat={ mat } />
        { children }
    </Obj3>
}
