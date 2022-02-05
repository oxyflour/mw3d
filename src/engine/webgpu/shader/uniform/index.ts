// FIXME: vite glob import with raw is not supported
import wgslUniformCamera from './g0.camera.wgsl?raw'
import wgslUniformLight from './g1.light.wgsl?raw'
import wgslUniformMesh from './g2.mesh.wgsl?raw'
import wgslUniformMaterial from './g3.material.wgsl?raw'
export default {
    g0: { camera: {
        wgsl: wgslUniformCamera,
        // used only for dynamic bind offset
        layout: {
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform', hasDynamicOffset: true }
            }]
        } as GPUBindGroupLayoutDescriptor,
    } },
    g1: { light: {
        wgsl: wgslUniformLight,
        // used only for dynamic bind offset
        layout: {
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform', hasDynamicOffset: true }
            }]
        } as GPUBindGroupLayoutDescriptor,
    } },
    g2: { mesh: {
        wgsl: wgslUniformMesh,
        // used only for dynamic bind offset
        layout: {
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX,
                buffer: { type: 'uniform', hasDynamicOffset: true }
            }]
        } as GPUBindGroupLayoutDescriptor,
    } },
    g3: { material: {
        wgsl: wgslUniformMaterial,
        // used only for dynamic bind offset
        layout: {
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform', hasDynamicOffset: true }
            }]
        } as GPUBindGroupLayoutDescriptor,
    } },
}
