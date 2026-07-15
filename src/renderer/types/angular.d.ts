declare namespace angular {
    type TorrentClient = import("@renderer/app/bittorrent/torrentclient").TorrentClient
    type ElectorrentServer = import("@renderer/app/services/server").Server

    interface SyncConnectionStatus {
        state: "normal" | "slow" | "broken"
        responseTimes: number[]
        lastResponseTime?: number
        slowThreshold?: number
    }

    interface IRootScopeService {
        $btclient?: TorrentClient | null
        $server?: ElectorrentServer | null
        $syncConnection?: SyncConnectionStatus
        labels?: string[]
    }
}
