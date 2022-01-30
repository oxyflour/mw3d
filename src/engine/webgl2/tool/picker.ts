import Camera from '../../camera'
import Material, { BasicMaterial } from '../../material'
import Mesh from '../../mesh'
import Obj3 from '../../obj3'
import Renderer from '../renderer'
import { RenderTarget } from '../../texture'

export default class Picker {
	constructor(private readonly renderer: Renderer,
		private cachedPickFrame = {
			width: renderer.width,
			height: renderer.height,
			frame: new RenderTarget(renderer.width, renderer.height),
		}) {
	}

	private cache = {
		list: [] as { obj: Mesh, mat: Material }[],
		set: new Set<Mesh>(),
		map: {} as Record<number, Mesh>,
		pixel: new Uint8Array(4),
	}
    private cachedPickMats = { } as { [id: number]: BasicMaterial }
    pick(objs: Set<Obj3>, camera: Camera, x: number, y: number) {
        const { renderer: { width, height, ctx }, cachedPickFrame, cachedPickMats } = this
        if (cachedPickFrame.width !== width || cachedPickFrame.height !== height) {
			const { frameBuffer, depthBuffer } = this.renderer.cache.renderTarget(cachedPickFrame.frame)
			frameBuffer && this.renderer.ctx.deleteFramebuffer(frameBuffer)
			depthBuffer && this.renderer.ctx.deleteRenderbuffer(depthBuffer)
			const texture = this.renderer.cache.texture(cachedPickFrame.frame.texture)
    		texture && this.renderer.ctx.deleteTexture(texture)
            Object.assign(cachedPickFrame, { width, height, frame: new RenderTarget(width, height) })
        }

		const { cache } = this
        for (const obj of objs) {
            if (obj instanceof Mesh) {
                const mat = obj.mat,
					r = (obj.id & 0xff),
					g = (obj.id & 0xff00) >> 8,
					b = (obj.id & 0xff0000) >> 16
                obj.mat = cachedPickMats[obj.id] ||
                    (cachedPickMats[obj.id] = new BasicMaterial({ color: new Uint8Array([r, g, b, 255]) }))
                cache.list.push({ obj, mat })
				cache.map[obj.id] = obj
				cache.set.add(obj)
            }
        }

        const { frame } = cachedPickFrame
        this.renderer.render(cache.set, camera, frame)

        const { texture } = frame
        ctx.readPixels(x, y, 1, 1, texture.format, texture.type, cache.pixel)

        for (const { obj, mat } of cache.list) {
            obj.mat = mat
        }

        const [r, g, b] = cache.pixel,
        	ret = cache.map[r + (g << 8) + (b << 16)]
		cache.list = [ ]
		cache.map = { }
		cache.set.clear()
		return ret
    }
}
