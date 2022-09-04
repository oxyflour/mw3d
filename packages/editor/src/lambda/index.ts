export default {
    async hello(name?: string) {
        // throw Error('x')
        return Buffer.from('world from a ' + name)
    },
    async upload(file: File) {
        console.log(await file.arrayBuffer())
    },
}
