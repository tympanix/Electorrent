import type { BittorrentFileSelection, BittorrentServerConfig } from "../../../shared/ipc-contract"

export type CallbackFunc<T = any> = (err: any, val: T) => void

export interface BittorrentRuntime {
    connect(server: BittorrentServerConfig): Promise<void>
    getSnapshot(fullUpdate?: boolean): Promise<any>
    addTorrentUrl(uri: string, options?: Record<string, any>): Promise<void>
    uploadTorrent(buffer: Uint8Array, filename: string, options?: Record<string, any>): Promise<void>
    getTorrentFiles?(hash: string): Promise<any>
    setTorrentFileSelection?(hash: string, files: BittorrentFileSelection[]): Promise<void>
    disconnect?(): Promise<void>
    [key: string]: any
}
