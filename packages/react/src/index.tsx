import { createRoot } from 'react-dom/client'
import React, { createContext, CSSProperties, useContext, useEffect, useRef, useState } from 'react'

// TODO: publish this package
import { Engine } from '../../core'

function rand(begin: number, end = 0) {
    return Math.random() * (end - begin) + begin
}

interface CanvasContextValue {
    scene?: Engine.Scene
    camera?: Engine.PerspectiveCamera
    canvas?: HTMLCanvasElement
}
const CanvasContext = createContext({ } as CanvasContextValue)
function Canvas({ children, options, style }: {
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
                camera = new Engine.PerspectiveCamera(60 / 180 * Math.PI, canvas.clientWidth / canvas.clientHeight, 1, 2000),
                light = new Engine.Light()
            camera.position.set(0, 0, 600)
            light.position.set(500, 500, 500)
            scene.add(light)
            requestAnimationFrame(function render() {
                if (handle.running) {
                    requestAnimationFrame(render)
                    renderer.render(scene, camera)
                }
            })
            setState({ scene, camera, canvas })
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

function Control() {
    const { canvas, camera } = useContext(CanvasContext)
    useEffect(() => {
        if (canvas && camera) {
            const control = new Engine.Control(canvas, camera)
            return () => { control.detach() }
        } else {
            return () => { }
        }
    }, [canvas, camera])
    return null
}

const Obj3Context = createContext({ } as { obj?: Engine.Obj3 })
function Obj3({ children, create, position }: {
    children: any
    position?: [number, number, number]
    create?: () => Engine.Obj3
}) {
    const { scene } = useContext(CanvasContext),
        { obj: node } = useContext(Obj3Context),
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
    }, [obj, position])
    return <Obj3Context.Provider value={{ obj }}>
        { children }
    </Obj3Context.Provider>
}

type Args<A> = A extends (...args: infer C) => any ? C : A

const MESH_DEFAULT_MAT = new Engine.BasicMaterial({ metallic: 1, roughness: 0.1 }),
    MESH_DEFAULT_GEO = new Engine.SphereGeometry({ radius: 100 })
function MeshSetter({ geo, mat }: {
    geo?: Engine.Geometry
    mat?: Engine.Material
}) {
    const { obj: mesh } = useContext(Obj3Context) as { obj: Engine.Mesh }
    useEffect(() => {
        if (mesh) {
            mesh.geo = geo || MESH_DEFAULT_GEO
            mesh.mat = mat || MESH_DEFAULT_MAT
        }
    }, [mesh, geo, mat])
    return null
}
function Mesh({ geo, mat, children, ...props }: {
    geo?: Engine.Geometry
    mat?: Engine.Material
} & Args<typeof Obj3>['0']) {
    return <Obj3 { ...props } create={ () => new Engine.Mesh(MESH_DEFAULT_GEO, MESH_DEFAULT_MAT) }>
        <MeshSetter geo={ geo } mat={ mat } />
        { children }
    </Obj3>
}

function App() {
    const [num, setNum] = useState(100)
    return <Canvas style={{ width: '100%', height: '100%' }}>
        <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            margin: 5,
        }}>
            <button onClick={ () => setNum(Math.floor(Math.random() * 5000 + 5000)) }>update</button>
        </div>
        <Control />
        {
            Array(num).fill(0).map((_, i) =>
            <Mesh key={ i } geo={ geo }
                position={ [rand(-200, 200), rand(-200, 200), rand(-200, 200)] }>
            </Mesh>)
        }
    </Canvas>
}

const geo = new Engine.SphereGeometry({ radius: 5 })
document.body.style.margin = document.body.style.padding = '0'
createRoot(document.getElementById('root')!).render(<App />)
