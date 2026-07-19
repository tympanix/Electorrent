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
    setLocation?(hashes: string[], location: string): Promise<void>
    getTorrentDetails?(hash: string): Promise<BittorrentTorrentDetailsData>
    getTorrentFiles?(hash: string): Promise<BittorrentTorrentDetailsFile[]>
    getTorrentPeers?(hash: string): Promise<BittorrentTorrentPeer[]>
    getTorrentTrackers?(hash: string): Promise<BittorrentTorrentDetailsTracker[]>
    setTorrentFileSelection?(hash: string, files: BittorrentFileSelection[]): Promise<void>
    disconnect?(): Promise<void>
}
