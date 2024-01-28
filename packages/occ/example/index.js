const { brep, step } = require('../'),
    { bool, primitive, builder } = brep,
    sphere = primitive.makeSphere([0, 0, 0], 1),
    plane = builder.makeFace([0, 0, 0], [1, 0, 0]),
    grid = [
        builder.makeEdge([0, -1, -0.5], [0, 1, -0.5]),
        builder.makeEdge([0, -1, -0.0], [0, 1, -0.0]),
        builder.makeEdge([0, -1,  0.5], [0, 1,  0.5]),
        builder.makeEdge([0, -0.5, -1], [0, -0.5, 1]),
        builder.makeEdge([0, -0.0, -1], [0, -0.0, 1]),
        builder.makeEdge([0,  0.5, -1], [0,  0.5, 1]),
    ],
    cs = bool.common([sphere], [plane]),
    sp = bool.split([cs], grid)
step.save('build/cs.stp', cs)
step.save('build/sp.stp', sp)
