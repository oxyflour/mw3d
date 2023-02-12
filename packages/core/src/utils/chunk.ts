export function parse(code: string) {
    const chunks = { } as Record<string, Record<string, string>>
    for (const chunk of code.split('// @chunk:')) {
        const name = chunk.slice(0, chunk.indexOf('\n')).trim(),
            map = chunks[name] = { } as Record<string, string>
        for (const part of chunk.split('// @')) {
            const head = part.slice(0, part.indexOf('\n')),
                name = head.trim()
            if (name) {
                map[name] = part.slice(head.length + 1)
            }
        }
    }
    return chunks
}
