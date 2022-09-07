import cp from 'child_process'

export type ForkData = { stdout?: string, stderr?: string }
export async function *fork(cmd: string, args?: string[]): AsyncGenerator<ForkData, void> {
    const proc = cp.spawn(cmd, args, { shell: true, stdio: 'pipe' }),
        output = [] as Function[],
        input = [] as ForkData[]
    function emit(data: ForkData) {
        if (output.length) {
            output.pop()?.(data)
        } else {
            input.push(data)
        }
    }
    proc.stdout.on('data', buf => emit({ stdout: buf.toString() }))
    proc.stderr.on('data', buf => emit({ stderr: buf.toString() }))
    proc.on('exit', () => emit({ }))
    while (proc.exitCode === null) {
        if (input.length) {
            yield input.pop()!
        } else {
            yield await new Promise(resolve => output.push(resolve))
        }
    }
    if (proc.exitCode !== 0) {
        throw Error(`process exited with code ${proc.exitCode}`)
    }
}
