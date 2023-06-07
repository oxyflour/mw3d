const { brep: { builder, bool, primitive } } = require('@yff/ncc'),
    fs = require('fs'),
    path = require('path')

function meshX(shape, xs, ys, zs, sx, ly) {
    for (let i = 0; i < xs.length - 1; i ++) {
        const [x0, x1] = [xs[i], xs[i + 1]],
            plane = builder.makeFace([x0, 0, 0], [1, 0, 0]),
            clip = [bool.common([shape], [plane])]
        for (let j = 0; j < ys.length - 1; j ++) {
            const [y0, y1] = [ys[j], ys[j + 1]]
            for (let k = 0; k < zs.length - 1; k ++) {
                const [z0, z1] = [zs[k], zs[k + 1]],
                    fv = bool.common(clip, [primitive.makeBox([x0, y0, z0], [x1, y1, z1])]),
                    ed = bool.common(clip, [builder.makeEdge([x0, y0, z0], [x0, y1, z0])]),
                    g = i + j * xs.length + j * xs.length * ys.length
                sx[g] = fv.getSurfaceProps().mass
                ly[g] = ed.getLinearProps().mass
            }
        }
    }
    return [sx, ly]
}
function meshY(shape, xs, ys, zs, sy, lz) {
    for (let j = 0; j < ys.length - 1; j ++) {
        const [y0, y1] = [ys[j], ys[j + 1]],
            plane = builder.makeFace([0, y0, 0], [0, 1, 0]),
            clip = [bool.common([shape], [plane])]
        for (let k = 0; k < zs.length - 1; k ++) {
            const [z0, z1] = [zs[k], zs[k + 1]]
            for (let i = 0; i < xs.length - 1; i ++) {
                const [x0, x1] = [xs[i], xs[i + 1]],
                    fv = bool.common(clip, [primitive.makeBox([x0, y0, z0], [x1, y1, z1])]),
                    ed = bool.common(clip, [builder.makeEdge([x0, y0, z0], [x0, y0, z1])]),
                    g = i + j * xs.length + j * xs.length * ys.length
                sy[g] = fv.getSurfaceProps().mass
                lz[g] = ed.getLinearProps().mass
            }
        }
    }
    return [sy, lz]
}
function meshZ(shape, xs, ys, zs, sz, lx) {
    for (let k = 0; k < zs.length - 1; k ++) {
        const [z0, z1] = [zs[k], zs[k + 1]],
            plane = builder.makeFace([0, 0, z0], [0, 0, 1]),
            clip = [bool.common([shape], [plane])]
        for (let i = 0; i < xs.length - 1; i ++) {
            const [x0, x1] = [xs[i], xs[i + 1]]
            for (let j = 0; j < ys.length - 1; j ++) {
                const [y0, y1] = [ys[j], ys[j + 1]],
                    fv = bool.common(clip, [primitive.makeBox([x0, y0, z0], [x1, y1, z1])]),
                    ed = bool.common(clip, [builder.makeEdge([x0, y0, z0], [x0, y0, z1])]),
                    g = i + j * xs.length + j * xs.length * ys.length
                sz[g] = fv.getSurfaceProps().mass
                lx[g] = ed.getLinearProps().mass
            }
        }
    }
    return [sz, lx]
}

class Mesher {
    constructor(xs, ys, zs) {
        this.grid = { xs, ys, zs }
    }
    getMats(shape) {
        const { xs, ys, zs } = this.grid,
            [nx, ny, nz] = [xs.length, ys.length, zs.length],
            [sx, sy, sz, lx, ly, lz] = Array(6).fill(0).map(() => new Float32Array(nx * ny * nz))
        meshX(shape, xs, ys, zs, sx, ly)
        meshY(shape, xs, ys, zs, sy, lz)
        meshZ(shape, xs, ys, zs, sz, lx)
        // TODO
    }
}

const mod = require('./build/Release/binding')
mod.cst.Project.prototype.getMeta = function() {
    const meta = {
        dt: 0,
        tn: 0,
    }

    const log = path.join(this.path.replace(/\.cst$/i, ''), 'Result', 'Model.log'),
        content = fs.readFileSync(log, 'utf-8'),
        [, dt, dtUnit] = content.match(/^\s*without subcycles:\s+(.*)\s+(\w+)\s*$/m) || ['', '', ''],
        [, tn] = content.match(/^\s*Simulated number of time steps:\s+(.*)\s+$/m) || ['', ''],
        map = {
            ns: 1e-9,
        }
    meta.dt = parseFloat(dt) * map[dtUnit]
    meta.tn = parseInt(tn)
    return meta
}
mod.occ = { Mesher }
module.exports = mod
