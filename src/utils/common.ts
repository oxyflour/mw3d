export function format(src: string, env: any) {
    const replaced = src.replace(/\/\/\$/g, '$').replace(/\/\/`/g, '`'),
        args = Object.keys(env).concat(`return \`${replaced}\``),
        func = new Function(...args)
    return func(...Object.values(env))
}
