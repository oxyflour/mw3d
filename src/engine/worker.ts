import wrap from "../utils/worker"
import { PerspectiveCamera } from "./camera"
import Obj3 from "./obj3"
import Renderer from "./webgpu/renderer"

let cache: ReturnType<typeof init>
async function init(canvas: OffscreenCanvas, opts?: Renderer['opts']) {
    const renderer = await Renderer.create(canvas, opts),
        camera = new PerspectiveCamera(45, 1, 1, 100)
    return { renderer, camera }
}

export default wrap({
    num: 1,
    fork: () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }),
    send: (args, next) => {
        const transfer = args.filter(arg => arg?.constructor?.name === 'OffscreenCanvas')
        return next(args, transfer)
    },
    recv: (args, next) => {
        return next(args)
    },
    api: {
        async init(canvas: OffscreenCanvas, opts?: Renderer['opts']) {
            await (cache || (cache = init(canvas, opts)))
        },
        async resize(width: number, height: number) {
            const { renderer } = await cache
            renderer.width = width
            renderer.height = height
        },
        async pick(scene: Set<Obj3>, { fov, aspect, near, far }: PerspectiveCamera) {
            const { renderer, camera } = await cache
            Object.assign(camera, { fov, aspect, near, far })
            console.log(scene)
        }
    }
})
