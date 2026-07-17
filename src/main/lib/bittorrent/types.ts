import type {
    BittorrentFileSelection,
    BittorrentServerConfig,
    TorrentClientConnection,
    BittorrentTorrentDetailsData,
    TorrentUploadOptions,
} from "@shared/ipc-contract"
import type { BittorrentActionArguments, BittorrentActionName } from "@shared/bittorrent-actions"

export type CallbackFunc<T = unknown> = (err: unknown, val: T) => void

export type BittorrentRuntimeAction<Action extends BittorrentActionName> = (
    hashes: string[],
    ...args: BittorrentActionArguments[Action]
) => Promise<unknown>

export type BittorrentRuntimeActions = {
    [Action in BittorrentActionName]?: BittorrentRuntimeAction<Action>
}

export interface BittorrentRuntime extends BittorrentRuntimeActions {
    connect(server: BittorrentServerConfig): Promise<TorrentClientConnection>
    getSnapshot(fullUpdate?: boolean): Promise<any>
    addTorrentUrl(uri: string, options?: TorrentUploadOptions): Promise<void>
    uploadTorrent(buffer: Uint8Array, filename: string, options?: TorrentUploadOptions): Promise<void>
    getTorrentDetails?(hash: string): Promise<BittorrentTorrentDetailsData>
    getTorrentFiles?(hash: string): Promise<BittorrentFileSelection[]>
    setTorrentFileSelection?(hash: string, files: BittorrentFileSelection[]): Promise<void>
    disconnect?(): Promise<void>
}
