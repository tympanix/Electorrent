import { DelugeRuntime } from "@main/lib/bittorrent/clients/deluge"
import { QBittorrentRuntime } from "@main/lib/bittorrent/clients/qbittorrent"
import { RtorrentRuntime } from "@main/lib/bittorrent/clients/rtorrent"
import { SynologyRuntime } from "@main/lib/bittorrent/clients/synology"
import { TransmissionRuntime } from "@main/lib/bittorrent/clients/transmission"
import { UtorrentRuntime } from "@main/lib/bittorrent/clients/utorrent"
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
