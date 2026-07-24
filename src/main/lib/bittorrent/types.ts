import type {
    BittorrentFileSelection,
    BittorrentServerConfig,
    TorrentClientConnection,
    BittorrentTorrentDetailsData,
    BittorrentTorrentDetailsFile,
    BittorrentTorrentPeer,
    BittorrentTorrentDetailsTracker,
    TorrentUploadOptions,
} from "@shared/ipc-contract"
import type { TorrentActionItem } from "@shared/torrent-actions"

export type CallbackFunc<T = unknown> = (err: unknown, val: T) => void

export interface BittorrentRuntime {
    readonly actions: TorrentActionItem[]
    connect(server: BittorrentServerConfig): Promise<TorrentClientConnection>
    getSnapshot(fullUpdate?: boolean): Promise<any>
    addTorrentUrl(uri: string, options?: TorrentUploadOptions): Promise<void>
    uploadTorrent(buffer: Uint8Array, filename: string, options?: TorrentUploadOptions): Promise<void>
    setLocation?(ids: string[], location: string): Promise<void>
    getTorrentDetails?(id: string): Promise<BittorrentTorrentDetailsData>
    getTorrentFiles?(id: string): Promise<BittorrentTorrentDetailsFile[]>
    getTorrentPeers?(id: string): Promise<BittorrentTorrentPeer[]>
    getTorrentTrackers?(id: string): Promise<BittorrentTorrentDetailsTracker[]>
    setTorrentFileSelection?(id: string, files: BittorrentFileSelection[]): Promise<void>
    disconnect?(): Promise<void>
}
