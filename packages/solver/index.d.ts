declare class Solver {
    constructor(grid: {
        xs: Float64Array
        ys: Float64Array
        zs: Float64Array
    }, port: {
        src: number[],
        dst: number[],
    }, mats: {
        eps: Float32Array
        mue: Float32Array
    }, dt: number)
    destroy(): void
    step(s: number): number
    step(s: Float32Array): Float32Array
}

export const fit = { Solver }

declare class Mesher {
    constructor(xs: Float64Array, ys: Float64Array, zs: Float64Array)
    getMats(shape: Shape): { eps: Float32Array, mue: Float32Array }
}

export const occ = { Mesher }

declare class Project {
    constructor(file: string, version: string | number)
    file: string
    version: string
    destroy(): void
    getHexGrid(): { xs: Float64Array, ys: Float64Array, zs: Float64Array }
    getMatrix(type: 100 | 101): Float32Array
    get1DResult(tree: string, num?: number, type?: 0 | 1): Float32Array
    getMeta(): {
        dt: number
        tn: number
    }
}

export const cst = { Project }
