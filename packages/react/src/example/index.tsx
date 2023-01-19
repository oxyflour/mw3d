import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Canvas, Control, Mesh, Engine } from '..'

function rand(begin: number, end = 0) {
    return Math.random() * (end - begin) + begin
}
const GEOMS = [
    new Engine.BoxGeometry({ size: 0.5 }),
    new Engine.SphereGeometry({ radius: 0.25 }),
] as Engine.Geometry[]

function makeMesh() {
    const s = rand(1, 5)
    return {
        position: [rand(-20, 20), rand(-20, 20), rand(-20, 20)] as [number, number, number],
        scaling:  [s, s, s] as [number, number, number],
        rotation: [rand(3), rand(3), rand(3)] as [number, number, number]
    }
}

const MESH_NUM = 1000,
    INIT_MESHES = Array(MESH_NUM).fill(0).map(makeMesh),
    INIT_MATERIAL = new Engine.BasicMaterial({ })
function App() {
    const [meshes, setMeshes] = useState(INIT_MESHES),
        [material, setMaterial] = useState(INIT_MATERIAL),
        [geometry, setGeometry] = useState(GEOMS[0]!),
        { prop } = material,
        [metallic, setMetallic] = useState(prop.metallic),
        [roughness, setRoughness] = useState(prop.roughness)
    function randomize() {
        setMaterial(new Engine.BasicMaterial({ metallic, roughness }))
        setMeshes(Array(MESH_NUM).fill(0).map(makeMesh))
    }
    const list = meshes.map(({ position, scaling, rotation }, idx) =>
        <Mesh key={ idx }
            geo={ geometry }
            mat={ material }
            position={ position }
            scaling={ scaling }
            rotation={ rotation }>
        </Mesh>)
    return <>
        <Canvas style={{ width: '50%', height: '50%' }}>
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
            { list }
        </Canvas>
        {
            /*
        <Canvas style={{ width: '50%', height: '50%' }}>
            <Control />
            { list }
        </Canvas>
             */
        }
    </>
}

document.body.style.margin = document.body.style.padding = '0'
const div = document.getElementById('root') as any,
    root = div.__root || (div.__root = createRoot(div))
root.render(<App />)
