import Mesh from '../engine/mesh'
import { BasicMaterial } from '../engine/material'
import { GaussianSplatGeometry } from '../engine/geometry'

type PlyFormat = 'ascii' | 'binary_little_endian' | 'binary_big_endian'

type PlyProperty = {
    name: string
    type: string
    isList: boolean
}

export type GaussianPlyOptions = {
    sizeScale?: number
    sizeMin?: number
    sizeMax?: number
    opacityScale?: number
    opacitySigmoid?: boolean
    materialAlpha?: number
}

export type GaussianPlyData = {
    positions: Float32Array
    colors: Float32Array
    covariances: Float32Array
    opacities: Float32Array
    count: number
}

const TYPE_INFO = {
    char:   { size: 1, read: (view: DataView, o: number) => view.getInt8(o) },
    int8:   { size: 1, read: (view: DataView, o: number) => view.getInt8(o) },
    uchar:  { size: 1, read: (view: DataView, o: number) => view.getUint8(o) },
    uint8:  { size: 1, read: (view: DataView, o: number) => view.getUint8(o) },
    short:  { size: 2, read: (view: DataView, o: number, le: boolean) => view.getInt16(o, le) },
    int16:  { size: 2, read: (view: DataView, o: number, le: boolean) => view.getInt16(o, le) },
    ushort: { size: 2, read: (view: DataView, o: number, le: boolean) => view.getUint16(o, le) },
    uint16: { size: 2, read: (view: DataView, o: number, le: boolean) => view.getUint16(o, le) },
    int:    { size: 4, read: (view: DataView, o: number, le: boolean) => view.getInt32(o, le) },
    int32:  { size: 4, read: (view: DataView, o: number, le: boolean) => view.getInt32(o, le) },
    uint:   { size: 4, read: (view: DataView, o: number, le: boolean) => view.getUint32(o, le) },
    uint32: { size: 4, read: (view: DataView, o: number, le: boolean) => view.getUint32(o, le) },
    float:  { size: 4, read: (view: DataView, o: number, le: boolean) => view.getFloat32(o, le) },
    float32:{ size: 4, read: (view: DataView, o: number, le: boolean) => view.getFloat32(o, le) },
    double: { size: 8, read: (view: DataView, o: number, le: boolean) => view.getFloat64(o, le) },
    float64:{ size: 8, read: (view: DataView, o: number, le: boolean) => view.getFloat64(o, le) },
} as const

const BYTE_TYPES = new Set(['uchar', 'uint8', 'char', 'int8'])

function parseHeader(buffer: ArrayBuffer) {
    const decoder = new TextDecoder('utf-8')
    const text = decoder.decode(buffer)
    const endIndex = text.indexOf('end_header')
    if (endIndex < 0) {
        throw Error('ply header not found')
    }
    const endLine = text.indexOf('\n', endIndex)
    const headerLength = endLine >= 0 ? endLine + 1 : endIndex + 'end_header'.length
    const header = text.slice(0, headerLength)
    const lines = header.split(/\r?\n/)

    let format = 'ascii' as PlyFormat
    let vertexCount = 0
    let inVertex = false
    const properties: PlyProperty[] = []
    for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (!parts[0]) {
            continue
        }
        if (parts[0] === 'format' && parts[1]) {
            format = parts[1] as PlyFormat
        } else if (parts[0] === 'element' && parts[1]) {
            inVertex = parts[1] === 'vertex'
            if (inVertex) {
                vertexCount = Number(parts[2] || 0)
            }
        } else if (parts[0] === 'property' && inVertex) {
            if (parts[1] === 'list') {
                properties.push({ name: parts[4] || '', type: parts[3] || '', isList: true })
            } else {
                properties.push({ name: parts[2] || '', type: parts[1] || '', isList: false })
            }
        }
    }
    if (!vertexCount) {
        throw Error('ply vertex count missing')
    }
    if (properties.some(prop => prop.isList)) {
        throw Error('ply list properties for vertex are not supported')
    }
    return { format, headerLength, header, properties, vertexCount, text }
}

function indexOfProperty(map: Map<string, number>, ...names: string[]) {
    for (const name of names) {
        const idx = map.get(name)
        if (idx !== undefined) {
            return idx
        }
    }
    return -1
}

function clamp01(value: number) {
    return Math.min(1, Math.max(0, value))
}

function valueAt(values: number[], idx: number, fallback = 0) {
    return idx >= 0 ? (values[idx] ?? fallback) : fallback
}

export function parseGaussianPly(buffer: ArrayBuffer, opts = { } as GaussianPlyOptions): GaussianPlyData {
    const { format, headerLength, properties, vertexCount, text } = parseHeader(buffer)
    const nameToIndex = new Map(properties.map((prop, idx) => [prop.name, idx]))
    const typeByIndex = properties.map(prop => prop.type)

    const xIdx = indexOfProperty(nameToIndex, 'x')
    const yIdx = indexOfProperty(nameToIndex, 'y')
    const zIdx = indexOfProperty(nameToIndex, 'z')
    if (xIdx < 0 || yIdx < 0 || zIdx < 0) {
        throw Error('ply vertex position not found')
    }

    const rIdx = indexOfProperty(nameToIndex, 'red', 'r')
    const gIdx = indexOfProperty(nameToIndex, 'green', 'g')
    const bIdx = indexOfProperty(nameToIndex, 'blue', 'b')
    const dc0Idx = indexOfProperty(nameToIndex, 'f_dc_0')
    const dc1Idx = indexOfProperty(nameToIndex, 'f_dc_1')
    const dc2Idx = indexOfProperty(nameToIndex, 'f_dc_2')
    const opacityIdx = indexOfProperty(nameToIndex, 'opacity', 'alpha')
    const scale0Idx = indexOfProperty(nameToIndex, 'scale_0')
    const scale1Idx = indexOfProperty(nameToIndex, 'scale_1')
    const scale2Idx = indexOfProperty(nameToIndex, 'scale_2')
    const scaleIdx = indexOfProperty(nameToIndex, 'scale', 'radius', 'point_size', 'size')
    const rot0Idx = indexOfProperty(nameToIndex, 'rot_0')
    const rot1Idx = indexOfProperty(nameToIndex, 'rot_1')
    const rot2Idx = indexOfProperty(nameToIndex, 'rot_2')
    const rot3Idx = indexOfProperty(nameToIndex, 'rot_3')

    const usesDc = dc0Idx >= 0 && dc1Idx >= 0 && dc2Idx >= 0
    const applySigmoid = opts.opacitySigmoid !== undefined ? opts.opacitySigmoid : usesDc
    const sizeScale = opts.sizeScale !== undefined ? opts.sizeScale : 1
    const opacityScale = opts.opacityScale !== undefined ? opts.opacityScale : 1

    const positions = new Float32Array(vertexCount * 3)
    const colors = new Float32Array(vertexCount * 3)
    const covariances = new Float32Array(vertexCount * 6)
    const opacities = new Float32Array(vertexCount)

    const C0 = 0.282095

    function normalizeChannel(value: number, idx: number) {
        const type = typeByIndex[idx] || ''
        if (BYTE_TYPES.has(type)) {
            return value / 255
        }
        return value
    }

    function resolveColor(values: number[]): [number, number, number] {
        if (rIdx >= 0 && gIdx >= 0 && bIdx >= 0) {
            return [
                normalizeChannel(valueAt(values, rIdx), rIdx),
                normalizeChannel(valueAt(values, gIdx), gIdx),
                normalizeChannel(valueAt(values, bIdx), bIdx)
            ]
        }
        if (usesDc) {
            return [
                clamp01(0.5 + valueAt(values, dc0Idx) * C0),
                clamp01(0.5 + valueAt(values, dc1Idx) * C0),
                clamp01(0.5 + valueAt(values, dc2Idx) * C0)
            ]
        }
        return [1, 1, 1]
    }

    function resolveOpacity(values: number[]): number {
        if (opacityIdx < 0) {
            return 1
        }
        let alpha = valueAt(values, opacityIdx, 1)
        if (applySigmoid) {
            alpha = 1 / (1 + Math.exp(-alpha))
        } else if (BYTE_TYPES.has(typeByIndex[opacityIdx] || '')) {
            alpha = alpha / 255
        }
        alpha *= opacityScale
        return clamp01(alpha)
    }

    function resolveScale(values: number[]): [number, number, number] {
        let sx = 1
        let sy = 1
        let sz = 1
        if (scale0Idx >= 0) {
            sx = Math.exp(valueAt(values, scale0Idx))
            sy = scale1Idx >= 0 ? Math.exp(valueAt(values, scale1Idx)) : sx
            sz = scale2Idx >= 0 ? Math.exp(valueAt(values, scale2Idx)) : sx
        } else if (scaleIdx >= 0) {
            sx = Math.max(0, valueAt(values, scaleIdx))
            sy = sx
            sz = sx
        } else if (scale2Idx >= 0) {
            sx = Math.exp(valueAt(values, scale2Idx))
            sy = sx
            sz = sx
        }
        sx *= sizeScale
        sy *= sizeScale
        sz *= sizeScale
        if (opts.sizeMin !== undefined) {
            sx = Math.max(opts.sizeMin, sx)
            sy = Math.max(opts.sizeMin, sy)
            sz = Math.max(opts.sizeMin, sz)
        }
        if (opts.sizeMax !== undefined) {
            sx = Math.min(opts.sizeMax, sx)
            sy = Math.min(opts.sizeMax, sy)
            sz = Math.min(opts.sizeMax, sz)
        }
        return [sx, sy, sz]
    }

    function resolveRotation(values: number[]): [number, number, number, number] {
        if (rot0Idx < 0 || rot1Idx < 0 || rot2Idx < 0 || rot3Idx < 0) {
            return [1, 0, 0, 0]
        }
        const w = valueAt(values, rot0Idx, 1)
        const x = valueAt(values, rot1Idx)
        const y = valueAt(values, rot2Idx)
        const z = valueAt(values, rot3Idx)
        const len = Math.hypot(w, x, y, z) || 1
        return [w / len, x / len, y / len, z / len]
    }

    function writeCovariance(dst: Float32Array, offset: number, scales: [number, number, number], rot: [number, number, number, number]) {
        const [sx, sy, sz] = scales
        const [w, x, y, z] = rot
        const xx = x * x
        const yy = y * y
        const zz = z * z
        const xy = x * y
        const xz = x * z
        const yz = y * z
        const wx = w * x
        const wy = w * y
        const wz = w * z
        const r00 = 1 - 2 * (yy + zz)
        const r01 = 2 * (xy - wz)
        const r02 = 2 * (xz + wy)
        const r10 = 2 * (xy + wz)
        const r11 = 1 - 2 * (xx + zz)
        const r12 = 2 * (yz - wx)
        const r20 = 2 * (xz - wy)
        const r21 = 2 * (yz + wx)
        const r22 = 1 - 2 * (xx + yy)
        const sx2 = sx * sx
        const sy2 = sy * sy
        const sz2 = sz * sz
        dst[offset] = r00 * r00 * sx2 + r01 * r01 * sy2 + r02 * r02 * sz2
        dst[offset + 1] = r10 * r10 * sx2 + r11 * r11 * sy2 + r12 * r12 * sz2
        dst[offset + 2] = r20 * r20 * sx2 + r21 * r21 * sy2 + r22 * r22 * sz2
        dst[offset + 3] = r00 * r10 * sx2 + r01 * r11 * sy2 + r02 * r12 * sz2
        dst[offset + 4] = r00 * r20 * sx2 + r01 * r21 * sy2 + r02 * r22 * sz2
        dst[offset + 5] = r10 * r20 * sx2 + r11 * r21 * sy2 + r12 * r22 * sz2
    }

    if (format === 'ascii') {
        const body = text.slice(headerLength)
        const lines = body.split(/\r?\n/)
        let lineIndex = 0
        for (let i = 0; i < vertexCount; i++) {
            while (lineIndex < lines.length && !lines[lineIndex]!.trim()) {
                lineIndex++
            }
            const line = lines[lineIndex++] || ''
            const parts = line.trim().split(/\s+/)
            if (parts.length < properties.length) {
                throw Error('ply vertex line is incomplete')
            }
            const values = parts.map(Number)
            const base = i * 3
            positions[base] = valueAt(values, xIdx)
            positions[base + 1] = valueAt(values, yIdx)
            positions[base + 2] = valueAt(values, zIdx)
            const [r, g, b] = resolveColor(values)
            colors[base] = r
            colors[base + 1] = g
            colors[base + 2] = b
            opacities[i] = resolveOpacity(values)
            const scales = resolveScale(values)
            const rot = resolveRotation(values)
            writeCovariance(covariances, i * 6, scales, rot)
        }
    } else if (format === 'binary_little_endian' || format === 'binary_big_endian') {
        const view = new DataView(buffer)
        let offset = headerLength
        const littleEndian = format === 'binary_little_endian'
        const values = new Array<number>(properties.length)
        for (let i = 0; i < vertexCount; i++) {
            for (let p = 0; p < properties.length; p++) {
                const { type } = properties[p]!
                const info = (TYPE_INFO as Record<string, { size: number, read: any }>)[type]
                if (!info) {
                    throw Error(`ply property type ${type} not supported`)
                }
                values[p] = info.read(view, offset, littleEndian)
                offset += info.size
            }
            const base = i * 3
            positions[base] = valueAt(values, xIdx)
            positions[base + 1] = valueAt(values, yIdx)
            positions[base + 2] = valueAt(values, zIdx)
            const [r, g, b] = resolveColor(values)
            colors[base] = r
            colors[base + 1] = g
            colors[base + 2] = b
            opacities[i] = resolveOpacity(values)
            const scales = resolveScale(values)
            const rot = resolveRotation(values)
            writeCovariance(covariances, i * 6, scales, rot)
        }
    } else {
        throw Error(`ply format ${format} not supported`)
    }

    return { positions, colors, covariances, opacities, count: vertexCount }
}

export function createGaussianPointCloud(buffer: ArrayBuffer, opts = { } as GaussianPlyOptions) {
    const { positions, colors, covariances, opacities } = parseGaussianPly(buffer, opts)
    const geo = new GaussianSplatGeometry({
        positions,
        colors,
        covariances,
        opacities,
    })
    const mat = new BasicMaterial({
        wgsl: { vert: 'vertGaussianMain', frag: 'fragGaussianMain' },
        color: [1, 1, 1, opts.materialAlpha !== undefined ? opts.materialAlpha : 0.99],
    })
    mat.prop.a = opts.materialAlpha !== undefined ? opts.materialAlpha : 0.99
    return new Mesh(geo, mat)
}
