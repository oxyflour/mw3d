/// <reference path="../../node_modules/@webgpu/types/dist/index.d.ts" />

export default class Renderer {
	private constructor(
		public readonly canvas: HTMLCanvasElement,
		private readonly opts = { } as {
			adaptorOptions?: GPURequestAdapterOptions
			deviceDescriptor?: GPUDeviceDescriptor
			canvasConfig?: GPUCanvasConfiguration
		}) {
	}
	private async init() {
		const adaptor = await navigator.gpu.requestAdapter(this.opts.adaptorOptions)
		if (!adaptor) {
			throw Error(`get gpu device failed`)
		}

		const context = this.canvas.getContext('gpupresent')
		if (!context) {
			throw Error(`get context failed`)
		}

		const device = this.opts.canvasConfig?.device || await adaptor.requestDevice(this.opts.deviceDescriptor),
			format = 'rgba8unorm'
		context.configure({ format, device, ...this.opts.canvasConfig })
		return this
	}
	static async create(canvas: HTMLCanvasElement) {
		return await new Renderer(canvas).init()
	}
}
