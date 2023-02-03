export function format(src: string, env: any) {
    const replaced = src.replace(/\/\/\$/g, '$').replace(/\/\/`/g, '`'),
        args = Object.keys(env).concat(`return \`${replaced}\``),
        func = new Function(...args)
    return func(...Object.values(env))
}

export class Mutable {
    rev = 1
}

export class AutoIndex {
    private static counter = 1
    readonly id: number
    constructor() {
        this.id = AutoIndex.counter ++
    }
}

export function queue<F extends (...args: any) => Promise<any>>(func: F) {
    let promise = Promise.resolve()
    return ((...args: any) => new Promise((resolve, reject) => {
        promise = promise.then(() => func(...args).then(resolve).catch(reject))
    })) as any as F
}
