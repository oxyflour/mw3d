import { useState } from "react"
import { CgSpinnerTwo } from "react-icons/cg"
import lambda from "../../../lambda"
import { Entity } from "../../../utils/data/entity"
import { upload } from "../../../utils/dom/upload"
import { Modal } from "../../utils/model"
import { Group } from "../utils/group"
import { ImageButton } from "../utils/image-button"

function OpenFile({ ents, setEnts }: { ents: Entity[], setEnts: (ents: Entity[]) => void }) {
    const [opening, setOpening] = useState(''),
        [logs, setLogs] = useState([] as string[])
    return <>
        {
            opening && <Modal title={ <><CgSpinnerTwo className="icon-spin inline" /> Opening {opening}</> }>
                <pre style={{ maxHeight: 300, overflow: 'hidden' }}>{ logs.join('\n') }</pre>
            </Modal>
        }
        <ImageButton title="open"
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
                        setEnts(ret)
                    } catch (err) {
                        // TODO
                        console.error(err)
                    }
                    setOpening('')
                })
            } />
    </>
}

export default ({ ents, setEnts }: {
    ents: Entity[]
    setEnts: (ents: Entity[]) => void
}) => {
    return <>
        <Group title="Home">
            <OpenFile { ...{ ents, setEnts } } />
        </Group>
    </>
}
