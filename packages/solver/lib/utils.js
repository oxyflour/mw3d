function binSearch(xs, x) {
    if (x < xs[0]) {
        return -1
    }
    let i = 0, j = xs.length
    while (i < j - 1) {
        const k = Math.floor((i + j) / 2)
        if (xs[k] < x) {
            i = k
        } else {
            j = k
        }
    }
    return i
}

function interp1(xs, ys, x) {
    const i = binSearch(xs, x)
    return i < 0 ? ys[0] : i >= xs.length - 1 ? ys[ys.length - 1] :
        ys[i] * (xs[i + 1] - x) / (xs[i + 1] - xs[i]) + ys[i + 1] * (x - xs[i]) / (xs[i + 1] - xs[i])
}

module.exports = { binSearch, interp1 }
