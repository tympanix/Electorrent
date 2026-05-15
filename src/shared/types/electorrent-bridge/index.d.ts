import type { ElectorrentBridge } from "@shareed/ipc-contract"

declare global {
    interface Window {
        electorrent: ElectorrentBridge
    }
}

export {}
