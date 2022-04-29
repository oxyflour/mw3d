import { Accessor, GlTf, MeshPrimitive } from "gltf-loader-ts/lib/gltf"

import Obj3 from "../engine/obj3"
import Mesh from "../engine/mesh"
import Material from "../engine/material"
import { version, name } from '../../package.json'
import { mat4 } from "gl-matrix"
import Camera from "../engine/camera"
import Light from "../engine/light"

export default {
    load(gltf: GlTf) {
    },
    save(...list: Set<Obj3>[]): GlTf {
        const objMap = { } as Record<number, Obj3>,
            meshMap = { } as Record<number, Mesh>,
            matMap = { } as Record<number, Material>,
            scenes = [] as { nodes: number[] }[]
        for (const items of list) {
            const nodes = [] as number[]
            for (const obj of items) {
                obj.walk(obj => {
                    nodes.push(obj.id)
                    objMap[obj.id] = obj
                    if (obj instanceof Mesh) {
                        meshMap[obj.id] = obj
                        const { mat } = obj
                        matMap[mat.id] = mat
                    }
                })
            }
            scenes.push({ nodes })
        }

        const objToNode = Object.fromEntries(Object.values(objMap).map((obj, idx) => [obj.id, idx])),
            objNum = Object.keys(objToNode).length,
            meshToNode = Object.fromEntries(Object.values(meshMap).map((mesh, idx) => [mesh.id, objNum + idx])),
            meshToMesh = Object.fromEntries(Object.values(meshMap).map((mesh, idx) => [mesh.id, idx])),
            matToMat = Object.fromEntries(Object.values(matMap).map((mat, idx) => [mat.id, idx]))
        
        const accessors = [] as GlTf['accessors'],
            bufferViews = [] as GlTf['bufferViews'],
            buffers = [] as GlTf['buffers'],
            geoPrim = { } as Record<number, MeshPrimitive>
        function appendBuffer(
                arr: Float32Array | Uint32Array | Int32Array | Uint16Array | Int16Array | Uint8Array | Int8Array,
                type: Accessor['type']) {
            const bufferIdx = buffers.length
            buffers.push({
                byteLength: arr.byteLength,
                uri: 'data:application/octet-stream;base64,' + btoa(String.fromCharCode(...new Uint8Array(arr.buffer)))
            })
            const viewIdx = bufferViews.length
            bufferViews.push({ buffer: bufferIdx, byteOffset: 0, byteLength: arr.byteLength })
            const accessorIdx = accessors.length,
                min = [] as number[],
                max = [] as number[]
            let count = arr.length
            if (type === 'VEC3') {
                min.push( Infinity,  Infinity,  Infinity)
                max.push(-Infinity, -Infinity, -Infinity)
                for (let i = 0; i < arr.length; i += 3) {
                    for (let j = 0; j < 3; j ++) {
                        min[j] = Math.min(min[j], arr[i + j])
                        max[j] = Math.max(max[j], arr[i + j])
                    }
                }
                count = arr.length / 3
            } else if (type === 'SCALAR') {
                min.push( Infinity)
                max.push(-Infinity)
                for (let i = 0; i < arr.length; i ++) {
                    min[0] = Math.min(min[0], arr[i])
                    max[0] = Math.max(max[0], arr[i])
                }
            } else {
                throw Error(`type ${type} not supported`)
            }
            accessors.push({
                bufferView: viewIdx,
                byteOffset: 0,
                componentType: {
                    Int8Array: 5120,
                    Uint8Array: 5121,
                    Int16Array: 5122,
                    Uint16Array: 5123,
                    Uint32Array: 5125,
                    Float32Array: 5126,
                }[arr.constructor.name],
                count,
                min,
                max,
                type,
            })
            return accessorIdx
        }

        const nodes = [] as GlTf['nodes']
        for (const obj of Object.values(objMap)) {
            const matrix = mat4.create()
            mat4.fromRotationTranslationScale(
                matrix, obj.rotation.data, obj.position.data, obj.scaling.data)
            nodes.push({
                matrix: Array.from(matrix),
                children: obj instanceof Mesh ?
                    [meshToNode[obj.id]] :
                    obj.children.size ? Array.from(obj.children).map(item => objToNode[item.id]) : undefined
            })
        }
        const meshes = [] as GlTf['meshes']
        for (const mesh of Object.values(meshMap)) {
            nodes.push({
                mesh: meshToMesh[mesh.id]
            })
            const { geo, mat } = mesh
            if (!geoPrim[geo.id]) {
                geoPrim[geo.id] = {
                    attributes: {
                        POSITION: appendBuffer(geo.positions, 'VEC3'),
                        NORMAL: geo.normals && appendBuffer(geo.normals, 'VEC3'),
                    },
                    indices: geo.indices && appendBuffer(geo.indices, 'SCALAR'),
                    mode: ({
                        'point-list': 0,
                        'line-list': 1,
                        'line-strip': 3,
                        'triangle-list': 4,
                        'triangle-strip': 5,
                    } as Record<GPUPrimitiveTopology, number>)[geo.type],
                }
            }
            meshes.push({
                primitives: [{
                    ...geoPrim[geo.id],
                    material: matToMat[mat.id]
                }]
            })
        }
        const materials = [] as GlTf['materials']
        for (const mat of Object.values(matMap)) {
            materials.push({
                pbrMetallicRoughness: {
                    baseColorFactor: [
                        mat.prop.r,
                        mat.prop.g,
                        mat.prop.b,
                        mat.prop.a,
                    ],
                    metallicFactor: mat.prop.metallic,
                    roughnessFactor: mat.prop.roughness,
                }
            })
        }
        return {
            asset: {
                generator: `${name}@${version}`,
                version: '2.0'
            },
            scenes,
            nodes,
            meshes,
            materials,
            accessors,
            buffers,
            bufferViews,
        }
    }
}
