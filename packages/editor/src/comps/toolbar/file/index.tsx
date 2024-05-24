import { useState } from "react"
import { CgSpinnerTwo } from "react-icons/cg"
import lambda from "../../../lambda"
import { Entity } from "../../../utils/data/entity"
import { ViewOpts } from "../../../utils/data/view"
import { upload } from "../../../utils/dom/upload"
import { Modal } from "../../utils/model"
import { Group } from "../utils/group"
import { ImageButton } from "../utils/image-button"

export function OpenFile({ ents, setEnts, updateView, add, title }: {
    ents: Entity[]
    setEnts: (ents: Entity[]) => void
    updateView: <K extends keyof ViewOpts>(key: K, val: Partial<ViewOpts[K]>) => void
    add?: boolean
    title?: string
}) {
    const [opening, setOpening] = useState(''),
        [logs, setLogs] = useState([] as string[])
    return <>
        {
            opening && <Modal title={ <><CgSpinnerTwo className="icon-spin inline" /> Opening {opening}</> }>
                <pre style={{ maxWidth: 500, maxHeight: 300, overflow: 'auto' }}>{ logs.join('\n') }</pre>
                {
                    logs[logs.length - 1]?.startsWith('ERROR: ') &&
                    <button className="btn" onClick={ () => setOpening('') }>close</button>
                }
            </Modal>
        }
        <ImageButton title={ title || "Open" }
            onClick={
                () => upload(async files => {
                    setOpening(Array.from(files || []).map(item => item.name).join(', '))
                    try {
                        const arr = files ? Array.from(files) : [],
                            ret = ents.slice(0, 0),
                            logs = [] as string[]
                        for await (const { entities, message } of lambda.shape.open(arr)) {
                            entities && ret.push(...entities)
                            if (message) {
                                logs.push(message)
                                setLogs(logs.slice())
                            }
                        }
                        setEnts(add ? ents.concat(ret) : ret)
                        updateView('camera', { resetAt: Date.now() })
                        setOpening('')
                    } catch (err: any) {
                        // TODO
                        console.error(err)
                        setLogs(logs.concat(`ERROR: ${err.message || err}`))
                    }
                })
            } />
    </>
}

export default ({ ents, setEnts, updateView }: {
    ents: Entity[]
    setEnts: (ents: Entity[]) => void
    updateView: <K extends keyof ViewOpts>(key: K, val: Partial<ViewOpts[K]>) => void
}) => {
    return <>
        <Group title="Home">
            <OpenFile { ...{ ents, setEnts, updateView } } />
        </Group>
    </>
}
