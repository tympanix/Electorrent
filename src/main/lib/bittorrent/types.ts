import type {
    BittorrentFileSelection,
    BittorrentServerConfig,
    TorrentClientConnection,
    BittorrentTorrentDetailsData,
    TorrentUploadOptions,
} from "@shared/ipc-contract"

export type CallbackFunc<T = unknown> = (err: unknown, val: T) => void

export interface BittorrentRuntime {
    connect(server: BittorrentServerConfig): Promise<TorrentClientConnection>
    getSnapshot(fullUpdate?: boolean): Promise<any>
    addTorrentUrl(uri: string, options?: TorrentUploadOptions): Promise<void>
    uploadTorrent(buffer: Uint8Array, filename: string, options?: TorrentUploadOptions): Promise<void>
    setLocation?(hashes: string[], location: string): Promise<void>
    getTorrentDetails?(hash: string): Promise<BittorrentTorrentDetailsData>
    getTorrentFiles?(hash: string): Promise<BittorrentFileSelection[]>
    setTorrentFileSelection?(hash: string, files: BittorrentFileSelection[]): Promise<void>
    disconnect?(): Promise<void>
}
