import { DelugeRuntime } from "@main/lib/bittorrent/clients/deluge"
import { QBittorrentRuntime } from "@main/lib/bittorrent/clients/qbittorrent"
import { RtorrentRuntime } from "@main/lib/bittorrent/clients/rtorrent"
import { MockBittorrentRuntime } from "@main/lib/bittorrent/clients/mock"
import { SynologyRuntime } from "@main/lib/bittorrent/clients/synology"
import { TransmissionRuntime } from "@main/lib/bittorrent/clients/transmission"
import { UtorrentRuntime } from "@main/lib/bittorrent/clients/utorrent"
import { isClientId, type ClientId } from "@shared/client-metadata"
import type { BittorrentRuntime } from "./types"

const runtimeFactories = {
    qbittorrent: () => new QBittorrentRuntime(),
    rtorrent: () => new RtorrentRuntime(),
    deluge: () => new DelugeRuntime(),
    mock: () => new MockBittorrentRuntime(),
    transmission: () => new TransmissionRuntime(),
    utorrent: () => new UtorrentRuntime(),
    synology: () => new SynologyRuntime(),
} satisfies Record<ClientId, () => BittorrentRuntime>

export function createRuntime(clientId: string): BittorrentRuntime {
    if (!isClientId(clientId)) {
        throw new Error(`Unsupported bittorrent client: ${clientId}`)
    }

    return runtimeFactories[clientId]()
}
