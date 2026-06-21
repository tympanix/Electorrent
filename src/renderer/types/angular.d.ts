declare namespace angular {
    type TorrentClient = import("@renderer/app/bittorrent/torrentclient").TorrentClient
    type StoredServerConfig = import("@shared/ipc-contract").StoredServerConfig
    type ColumnProps = import("@renderer/app/services/column").ColumnProps

    interface ElectorrentServer extends Omit<StoredServerConfig, "columns"> {
        columns: ColumnProps[]
        isConnected: boolean
        connect(): IPromise<void>
        getName(): string
        getIcon(): string
        getNameAtAddress(): string
        getDisplayName(): string
        setPath(): void
        url(): string
        json(): StoredServerConfig
    }

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
    }
}
