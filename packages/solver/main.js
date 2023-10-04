const { interp1 } = require('./lib/utils'),
    fs = require('fs')

function makeSrc(proj, dt, tn) {
    const tree = "1D Results\\Port signals\\i1",
        [sx, sy] = [0, 1].map(type => proj.get1DResult(tree, 0, type === 0 ? 0 : 1)),
        src = new Float32Array(tn)
    for (let i = 0; i < tn; i ++) {
        src[i] = interp1(sx, sy, i * dt * 1e9);
    }
    return src
}

const { fit: { Solver }, occ: { Mesher }, cst: { Project } } = require('.'),
    proj = new Project('D:\\Projects\\cst-demo\\dipole-1.cst', 2019),
    grid = proj.getHexGrid(),
    { dt, tn: tn0 } = proj.getMeta(),
    tn = tn0 * 10,
    src = makeSrc(proj, dt, tn),
    mats = { eps: proj.getMatrix(100), mue: proj.getMatrix(101) },
    port = { src: [25e-3, 0, 2e-3], dst: [25e-3, 0, -2e-3] },
    solver = new Solver(grid, port, mats, dt)

console.time('run')
console.log(`dt ${dt * 1e9} ns, ${tn} time steps`)
const out = solver.step(src),
    csv = Array.from(out).map((sig, idx) => `${idx},${src[idx]},${sig}`).join('\n')
fs.writeFileSync(__dirname + '/build/plot.csv', csv)
console.timeEnd('run')

proj.destroy()
solver.destroy()
