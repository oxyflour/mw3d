import { fork } from "../utils/node/fork"

export default {
    async *open() {
        yield *fork('ping localhost -n 10')
    },
}
