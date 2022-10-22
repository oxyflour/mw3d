import { useCanvas, Engine } from "@ttk/react"
import { useEffect } from "react"

const AXIS_TEXT_SIZE = 64 * window.devicePixelRatio

async function createTextTexture(text: string, style: string, width: number, height: number) {
    const tex = document.createElement('canvas'),
        ctx = tex.getContext('2d')
    tex.width = width
    tex.height = height
    if (ctx) {
        ctx.font = height + 'px Arial'
        ctx.textAlign = 'center'
        ctx.fillStyle = style
        ctx.textBaseline = 'middle'
        ctx.fillText(text, width / 2, height / 2)
    }
    const source = await createImageBitmap(tex),
        { Usage } = Engine.Texture
    return new Engine.Texture({
        source,
        size: { width: tex.width, height: tex.height },
        format: 'rgba8unorm',
        usage: Usage.TEXTURE_BINDING | Usage.COPY_DST | Usage.RENDER_ATTACHMENT,
    })
}

async function attachTextToSprite(mesh: Engine.Mesh, text: string, style: string) {
    mesh.mat = new Engine.BasicMaterial()
    const texture = await createTextTexture(text, style, AXIS_TEXT_SIZE, AXIS_TEXT_SIZE)
    mesh.mat = new Engine.BasicMaterial({ texture })
}

const VIEW_AXIES = new Engine.Obj3({
    children: [
        new Engine.Mesh(new Engine.LineList({
            lines: [new Float32Array([0, 0, 0, 1, 0, 0])]
        }), new Engine.BasicMaterial({
            lineWidth: 3,
            color: [1, 0, 0]
        })),
        new Engine.Mesh(new Engine.SpriteGeometry({
            position: [1.2, 0, 0],
            width: AXIS_TEXT_SIZE, height: AXIS_TEXT_SIZE, fixed: true,
        })),
        new Engine.Mesh(new Engine.LineList({
            lines: [new Float32Array([0, 0, 0, 0, 1, 0])]
        }), new Engine.BasicMaterial({
            lineWidth: 3,
            color: [0, 1, 0]
        })),
        new Engine.Mesh(new Engine.SpriteGeometry({
            position: [0, 1.2, 0],
            width: AXIS_TEXT_SIZE, height: AXIS_TEXT_SIZE, fixed: true,
        })),
        new Engine.Mesh(new Engine.LineList({
            lines: [new Float32Array([0, 0, 0, 0, 0, 1])]
        }), new Engine.BasicMaterial({
            lineWidth: 3,
            color: [0, 0, 1]
        })),
        new Engine.Mesh(new Engine.SpriteGeometry({
            position: [0, 0, 1.2],
            width: AXIS_TEXT_SIZE, height: AXIS_TEXT_SIZE, fixed: true,
        })),
    ]
})

export function Axies() {
    const { scene } = useCanvas()
    useEffect(() => {
        if (scene) {
            scene.add(VIEW_AXIES)
            const [, x, , y, , z] = VIEW_AXIES.children
            x instanceof Engine.Mesh && !x.mat && attachTextToSprite(x, 'x', 'red')
            y instanceof Engine.Mesh && !y.mat && attachTextToSprite(y, 'y', 'green')
            z instanceof Engine.Mesh && !z.mat && attachTextToSprite(z, 'z', 'blue')
            return () => { scene.delete(VIEW_AXIES) }
        } else {
            return () => { }
        }
    }, [scene])
    return null
}
