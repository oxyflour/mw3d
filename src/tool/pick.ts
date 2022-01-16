import Camera from '../engine/camera'
import Material, { BasicMaterial } from '../engine/material'
import Mesh from '../engine/mesh'
import Obj3 from '../engine/obj3'
import Renderer from '../engine/renderer'
import { RenderTarget } from '../engine/texture'

export default class Picker {
	constructor(private readonly renderer: Renderer,
		private cachedPickFrame = {
			width: renderer.width,
			height: renderer.height,
			frame: new RenderTarget(renderer.width, renderer.height),
		}) {
	}

	private cachedMeshes = {
		list: [] as { obj: Mesh, mat: Material }[],
		set: new Set<Mesh>(),
		map: {} as Record<number, Mesh>,
		pixel: new Uint8Array(4),
	}
    private cachedPickMats = { } as { [id: number]: BasicMaterial }
    pick(objs: Set<Obj3>, camera: Camera, x: number, y: number) {
        const { renderer: { width, height, ctx }, cachedPickFrame, cachedPickMats } = this
        if (cachedPickFrame.width !== width || cachedPickFrame.height !== height) {
            cachedPickFrame.frame.dispose(this.renderer)
            Object.assign(cachedPickFrame, { width, height, frame: new RenderTarget(width, height) })
        }

		const { cachedMeshes } = this
        for (const obj of objs) {
            if (obj instanceof Mesh) {
                const mat = obj.mat,
					r = (obj.id & 0xff),
					g = (obj.id & 0xff00) >> 8,
					b = (obj.id & 0xff0000) >> 16
                obj.mat = cachedPickMats[obj.id] ||
                    (cachedPickMats[obj.id] = new BasicMaterial({ color: new Uint8Array([r, g, b, 255]) }))
                cachedMeshes.list.push({ obj, mat })
				cachedMeshes.map[obj.id] = obj
				cachedMeshes.set.add(obj)
            }
        }

        const { frame } = cachedPickFrame
        this.renderer.render(cachedMeshes.set, camera, frame)

        const { texture } = frame
        ctx.readPixels(x, y, 1, 1, texture.format, texture.type, cachedMeshes.pixel)

        for (const { obj, mat } of cachedMeshes.list) {
            obj.mat = mat
        }

        const [r, g, b] = cachedMeshes.pixel,
        	ret = cachedMeshes.map[r + (g << 8) + (b << 16)]
		cachedMeshes.list = [ ]
		cachedMeshes.map = { }
		cachedMeshes.set.clear()
		return ret
    }
}
