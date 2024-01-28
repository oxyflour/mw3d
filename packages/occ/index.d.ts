type Vec3 = {
    x: number
    y: number
    z: number
}
type XYZ = Vec3 | [
    number,
    number,
    number
]

declare enum ShapeType {
    COMPOUND,
    COMPSOLID,
    EDGE,
    FACE,
    SHAPE,
    SHELL,
    SOLID,
    VERTEX,
    WIRE,
}

declare class Shape {
    static types: typeof ShapeType
    type: ShapeType
    meta: Record<string, string>
    find(type: ShapeType): Shape[]
    bound(): { min: Vec3, max: Vec3 }

    getLinearProps(): { mass: number }
    getSurfaceProps(): { mass: number }
    getVolumeProps(): { mass: number }
}

export const brep: {
    save(file: string, shape: Shape): void
    save(shape: Shape): Buffer
    load(file: string): Shape
    load(buffer: Buffer): Shape
    builder: {
        makeVertex(p0: XYZ): Shape
        makeEdge(p0: XYZ, p1: XYZ): Shape
        makeFace(pos: XYZ, dir: XYZ): Shape
        makeFace(wire: Shape): Shape
        makeWire(edges: Shape[]): Shape
        makeShell(wires: Shape[]): Shape
        makeCompound(shapes: Shape[]): Shape
        makeSolid(shapes: Shape[]): Shape
        toNurbs(shape: Shape): Shape
    }
    primitive: {
        makeSphere(p: XYZ, r: number): Shape
        makeBox(p0: XYZ, p1: XYZ): Shape
    }
    bool: {
        fuse(args: Shape[], tools: Shape[], opts?: { fuzzyValue?: number }): Shape
        common(args: Shape[], tools: Shape[], opts?: { }): Shape
        cut(args: Shape[], tools: Shape[], opts?: { }): Shape
        section(args: Shape[], tools: Shape[], opts?: { }): Shape
        split(args: Shape[], tools: Shape[], opts?: { }): Shape
    }
}

export const tool: {
    mesh(shapes: Shape[], xs: number[], ys: number[], zs: number[]): {
        i: number
        j: number
        k: number
        s: number
        p: Shape
    }[]
}

export type Face = {
    positions: Float32Array
    indices: Uint32Array
    normals: Float32Array 
}
export type Edge = {
    positions: Float32Array
}

export const mesh: {
    create(shape: Shape, opts?: {
        angle?: number
        deflection?: number
    }): Face
    poly(shape: Shape, opts?: {
        angle?: number
        deflection?: number
        tol?: number
    }): {
        positions: Float32Array
        indices: Uint32Array
        groups: Uint32Array[]
    }
    topo(shape: Shape, opts?: {
        angle?: number
        deflection?: number
    }): {
        geom: Face
        verts: Float32Array
        faces: Face[]
        edges: Edge[]
    }
}

export const step: {
    save(file: string, shape: Shape): void
    load(file: string): Shape
}
