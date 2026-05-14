import type { ElectorrentBridge } from "../../../shared/ipc-contract"

declare global {
    interface Window {
        electorrent: ElectorrentBridge
    }
}

export {}
