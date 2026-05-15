import type { ElectorrentBridge } from "../../ipc-contract"

declare global {
    interface Window {
        electorrent: ElectorrentBridge
    }
}

export {}
