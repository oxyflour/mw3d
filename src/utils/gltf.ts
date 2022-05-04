import { Accessor, GlTf, MeshPrimitive } from "gltf-loader-ts/lib/gltf"

import Obj3 from "../engine/obj3"
import Mesh from "../engine/mesh"
import Material, { BasicMaterial } from "../engine/material"
import Geometry from "../engine/geometry"
// @ts-ignore
import { version, name } from '../../package.json'
import { mat4 } from "gl-matrix"

export default {
    async load(gltf: GlTf) {
        const list = [] as Set<Obj3>[],
            { scenes = [], nodes = [], meshes = [], materials = [] } = gltf,
            { accessors = [], bufferViews = [], buffers = [] } = gltf,
            bufCache = { } as Record<string, Promise<ArrayBuffer>>,
            nodeToObj = { } as Record<number, Obj3>,
            geoCache = { } as Record<string, Geometry>,
            matCache = { } as Record<number, Material>
        async function getBuf(uri: string) {
            const req = await fetch(uri)
            return await req.arrayBuffer()
        }
        async function getArr(idx: number) {
            const accessor = accessors[idx],
                { bufferView = -1, componentType = -1 } = accessor || { },
                { buffer = -1 } = bufferViews[bufferView] || { },
                { uri = '' } = buffers[buffer] || { },
                constructor = {
                    5120: Int8Array,
                    5121: Uint8Array,
                    5122: Int16Array,
                    5123: Uint16Array,
                    5125: Uint32Array,
                    5126: Float32Array,
                }[componentType]
            if (!uri || !constructor) {
                throw Error(`get accessor ${idx} failed`)
            }
            const buf = await (bufCache[uri] || (bufCache[uri] = getBuf(uri)))
            return new constructor(buf)
        }
        async function getGeo({ attributes, indices, mode = -1 }: MeshPrimitive) {
            const key = [mode, indices, attributes.POSITION, attributes.NORMAL].join('/')
            return geoCache[key] || (geoCache[key] = new Geometry({
                type: {
                    [0]: 'point-list',
                    [1]: 'line-list',
                    [3]: 'line-strip',
                    [4]: 'triangle-list',
                    [5]: 'triangle-strip',
                }[mode] as GPUPrimitiveTopology,
                positions: await getArr(attributes.POSITION || -1) as Float32Array,
                normals: await getArr(attributes.NORMAL || -1) as Float32Array,
                indices: indices !== undefined ? await getArr(indices) as any : undefined,
            }))
        }
        async function getMat({ material = -1 }: MeshPrimitive) {
            const { pbrMetallicRoughness = { } } = materials[material] || { },
                { baseColorFactor, metallicFactor, roughnessFactor } = pbrMetallicRoughness
            return matCache[material] || (matCache[material] = new BasicMaterial({
                color: baseColorFactor || [],
                metallic: metallicFactor,
                roughness: roughnessFactor,
            }))
        }
        for (const scene of scenes) {
            const objs = [] as Obj3[]
            for (const idx of scene.nodes || []) {
                const node = nodes[idx] || { },
                    mesh = nodes[node.children?.[0] || -1]?.mesh
                let obj: undefined | Obj3
                if (mesh !== undefined) {
                    const { primitives = [] } = meshes[mesh] || { },
                        [prim] = primitives
                    if (!prim) {
                        throw Error(`no primitives found in mesh ${mesh}`)
                    }
                    obj = nodeToObj[idx] || (nodeToObj[idx] = new Mesh(await getGeo(prim), await getMat(prim)))
                    objs.push(obj)
                } else if (!node.mesh) {
                    obj = nodeToObj[idx] || (nodeToObj[idx] = new Obj3())
                    objs.push(obj)
                }
                if (obj && node.matrix) {
                    mat4.getRotation(obj.rotation.data, new Float32Array(node.matrix))
                    mat4.getScaling(obj.scaling.data, new Float32Array(node.matrix))
                    mat4.getTranslation(obj.position.data, new Float32Array(node.matrix))
                }
            }
            for (const idx of scene.nodes || []) {
                const node = nodes[idx] || { },
                    mesh = nodes[node?.children?.[0] || -1]?.mesh
                if (!mesh) {
                    for (const item of node?.children || []) {
                        const [child, parent] = [nodeToObj[item], nodeToObj[idx]]
                        child && parent && child.addTo(parent)
                    }
                }
            }
            list.push(new Set(objs.filter(item => !item.getParent())))
        }
        return list
    },
    save(list: Set<Obj3>[]): GlTf {
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
        
        const accessors = [] as NonNullable<GlTf['accessors']>,
            bufferViews = [] as NonNullable<GlTf['bufferViews']>,
            buffers = [] as NonNullable<GlTf['buffers']>,
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
                        min[j] = Math.min(min[j]!, arr[i + j]!)
                        max[j] = Math.max(max[j]!, arr[i + j]!)
                    }
                }
                count = arr.length / 3
            } else if (type === 'SCALAR') {
                min.push( Infinity)
                max.push(-Infinity)
                for (let i = 0; i < arr.length; i ++) {
                    min[0] = Math.min(min[0]!, arr[i]!)
                    max[0] = Math.max(max[0]!, arr[i]!)
                }
            } else {
                throw Error(`type ${type} not supported`)
            }
            const componentType = {
                Int8Array: 5120,
                Uint8Array: 5121,
                Int16Array: 5122,
                Uint16Array: 5123,
                Uint32Array: 5125,
                Float32Array: 5126,
            }[arr.constructor.name]
            if (!componentType) {
                throw Error(`unknown component ${arr.constructor.name}`)
            }
            accessors.push({
                bufferView: viewIdx,
                byteOffset: 0,
                componentType,
                count,
                min,
                max,
                type,
            })
            return accessorIdx
        }

        const nodes = [] as NonNullable<GlTf['nodes']>
        for (const obj of Object.values(objMap)) {
            const matrix = mat4.create()
            mat4.fromRotationTranslationScale(
                matrix, obj.rotation.data, obj.position.data, obj.scaling.data)
            nodes.push({
                matrix: Array.from(matrix),
                ...(obj instanceof Mesh ? {
                    children: [meshToNode[obj.id] || -1],
                } : obj.children.size ? {
                    children: Array.from(obj.children).map(item => objToNode[item.id] || -1)
                } : { })
            })
        }
        const meshes = [] as NonNullable<GlTf['meshes']>
        for (const mesh of Object.values(meshMap)) {
            nodes.push({
                mesh: meshToMesh[mesh.id]
            })
            const { geo, mat } = mesh,
                geometry = geoPrim[geo.id] || (geoPrim[geo.id] = {
                    attributes: {
                        POSITION: appendBuffer(geo.positions, 'VEC3'),
                        ...(geo.normals ? {
                            NORMAL: appendBuffer(geo.normals, 'VEC3'),
                        }: { })
                    },
                    indices: geo.indices && appendBuffer(geo.indices, 'SCALAR'),
                    mode: ({
                        'point-list': 0,
                        'line-list': 1,
                        'line-strip': 3,
                        'triangle-list': 4,
                        'triangle-strip': 5,
                    } as Record<GPUPrimitiveTopology, number>)[geo.type],
                })
            meshes.push({
                primitives: [{
                    ...geometry,
                    material: matToMat[mat.id]
                }]
            })
        }
        const materials = [] as NonNullable<GlTf['materials']>
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
