import type { ElectorrentBridge } from "../../../common/ipc-contract"

declare global {
    interface Window {
        electorrent: ElectorrentBridge
    }
}

export {}
