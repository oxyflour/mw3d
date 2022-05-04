import { createRoot } from 'react-dom/client'
import React, { createContext, CSSProperties, useContext, useEffect, useRef, useState } from 'react'

// TODO: publish this package
import { Engine } from '../../core'
import { mat4, quat } from 'gl-matrix'

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
function Obj3({ children, create, matrix, position, rotation, scaling }: {
    children: any
    matrix?: number[]
    position?: [number, number, number]
    rotation?: [number, number, number]
    scaling?: [number, number, number]
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

const MESH_DEFAULT_MAT = new Engine.BasicMaterial({ metallic: 1, roughness: 0.5 }),
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
    return <Obj3 { ...props }
            create={ () => new Engine.Mesh(MESH_DEFAULT_GEO, MESH_DEFAULT_MAT) }>
        <MeshSetter geo={ geo } mat={ mat } />
        { children }
    </Obj3>
}

const GEOMS = [
    new Engine.BoxGeometry({ size: 5 }),
    new Engine.SphereGeometry({ radius: 2.5 }),
] as Engine.Geometry[]

function makeMesh() {
    const s = rand(1, 5)
    return {
        position: [rand(-200, 200), rand(-200, 200), rand(-200, 200)] as [number, number, number],
        scaling:  [s, s, s] as [number, number, number],
        rotation: [rand(3), rand(3), rand(3)] as [number, number, number]
    }
}

const MESH_NUM = 1000,
    INIT_MESHES = Array(MESH_NUM).fill(0).map(makeMesh)
function App() {
    const [meshes, setMeshes] = useState(INIT_MESHES),
        [material, setMaterial] = useState(MESH_DEFAULT_MAT),
        [geometry, setGeometry] = useState(GEOMS[0]!),
        { prop } = material,
        [metallic, setMetallic] = useState(prop.metallic),
        [roughness, setRoughness] = useState(prop.roughness)
    function randomize() {
        setMaterial(new Engine.BasicMaterial({ metallic, roughness }))
        setMeshes(Array(MESH_NUM).fill(0).map(makeMesh))
    }
    return <Canvas style={{ width: '100%', height: '100%' }}>
        <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            margin: 15,
        }}>
            <button onClick={ randomize }>
                randomize
            </button>
            <span> </span>
            <select value={ geometry.id }
                onChange={ evt => setGeometry(GEOMS.find(geo => geo.id === parseInt(evt.target.value))!) }>
                { GEOMS.map((geo, idx) => <option key={ geo.id } value={ geo.id }>{ ['box', 'sphere'][idx] }</option>) }
            </select>
            <br />
            metallic <input type="range"
                value={ metallic }
                onChange={ evt => setMetallic(prop.metallic = parseFloat(evt.target.value)) }
                min={ 0 } max={ 1 } step={ 0.01 } />
            <br />
            roughness <input type="range"
                value={ roughness }
                onChange={ evt => setRoughness(prop.roughness = parseFloat(evt.target.value)) }
                min={ 0 } max={ 1 } step={ 0.01 } />
        </div>
        <Control />
        {
            meshes.map(({ position, scaling, rotation }, idx) =>
            <Mesh key={ idx }
                geo={ geometry }
                mat={ material }
                position={ position }
                scaling={ scaling }
                rotation={ rotation }>
            </Mesh>)
        }
    </Canvas>
}

document.body.style.margin = document.body.style.padding = '0'
createRoot(document.getElementById('root')!).render(<App />)
