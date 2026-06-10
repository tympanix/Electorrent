import type {
    BittorrentFileSelection,
    BittorrentServerConfig,
    TorrentClientFeatures,
    BittorrentTorrentDetailsData,
} from "@shared/ipc-contract"

export type CallbackFunc<T = any> = (err: any, val: T) => void

export interface BittorrentRuntime {
    connect(server: BittorrentServerConfig): Promise<TorrentClientFeatures>
    getSnapshot(fullUpdate?: boolean): Promise<any>
    addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void>
    uploadTorrent(buffer: Uint8Array, filename: string, options?: Record<string, any>): Promise<void>
    setLocation?(hashes: string[], location: string): Promise<void>
    getTorrentDetails?(hash: string): Promise<BittorrentTorrentDetailsData>
    getTorrentFiles?(hash: string): Promise<any>
    setTorrentFileSelection?(hash: string, files: BittorrentFileSelection[]): Promise<void>
    disconnect?(): Promise<void>
    [key: string]: any
}
