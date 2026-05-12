import { DelugeRuntime } from "./clients/deluge"
import { QBittorrentRuntime } from "./clients/qbittorrent"
import { RtorrentRuntime } from "./clients/rtorrent"
import { SynologyRuntime } from "./clients/synology"
import { TransmissionRuntime } from "./clients/transmission"
import { UtorrentRuntime } from "./clients/utorrent"
import type { BittorrentRuntime } from "./types"

export function createRuntime(clientId: string): BittorrentRuntime {
    switch (clientId) {
        case "qbittorrent":
            return new QBittorrentRuntime()
        case "rtorrent":
            return new RtorrentRuntime()
        case "deluge":
            return new DelugeRuntime()
        case "transmission":
            return new TransmissionRuntime()
        case "utorrent":
            return new UtorrentRuntime()
        case "synology":
            return new SynologyRuntime()
        default:
            throw new Error(`Unsupported bittorrent client: ${clientId}`)
    }
}
