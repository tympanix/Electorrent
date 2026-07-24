import type {
    BittorrentTorrentDetailsData,
    ElectorrentBridge,
    BittorrentFileSelection,
    BittorrentTorrentPeer,
    BittorrentServerConfig,
    TorrentClientConnection,
    TorrentUploadOptions,
} from "@shared/ipc-contract"
import type { TorrentActionItem } from "@shared/torrent-actions"

declare const window: Window & { electorrent: ElectorrentBridge }

function bridge() {
    return window.electorrent.bittorrent
}

export function serializeServer(server: any): BittorrentServerConfig {
    const data = typeof server?.json === "function" ? server.json() : { ...server }
    const certificateData = typeof server?.getCertificate === "function"
        ? server.getCertificate()
        : server?.certificateData

    return {
        ...data,
        certificateData: certificateData ? new Uint8Array(certificateData) : undefined,
    }
}

export async function connect(server: any): Promise<TorrentClientConnection> {
    const result = await bridge().connect(serializeServer(server))
    if (result.ok === false) {
        throw Object.assign(new Error(result.error.message), result.error)
    }

    return result.connection
}

export function disconnect() {
    return bridge().disconnect()
}

export function getSnapshot(fullUpdate?: boolean) {
    return bridge().getSnapshot({ fullUpdate: !!fullUpdate })
}

export function addTorrentUrl(uri: string, options?: TorrentUploadOptions) {
    return bridge().addTorrentUrl({ uri, options })
}

export function uploadTorrent(data: Uint8Array, filename: string, options?: TorrentUploadOptions, sourcePath?: string) {
    return bridge().uploadTorrent({ data, filename, options, sourcePath })
}

export function invokeAction(action: string, ids: string[] = [], ...args: unknown[]) {
    return bridge().invokeAction({ action, ids, args })
}

export function getActions(): Promise<TorrentActionItem[]> {
    return bridge().getActions()
}

export function setSelectedTorrents(ids: string[]) {
    return bridge().setSelectedTorrents(ids)
}

export function getTorrentDetails(id: string): Promise<BittorrentTorrentDetailsData> {
    return bridge().getTorrentDetails({ id })
}

export function getTorrentFiles(id: string) {
    return bridge().getTorrentFiles({ id })
}

export function getTorrentPeers(id: string): Promise<BittorrentTorrentPeer[]> {
    return bridge().getTorrentPeers({ id })
}

export function getTorrentTrackers(id: string) {
    return bridge().getTorrentTrackers({ id })
}

export function setTorrentFileSelection(id: string, files: BittorrentFileSelection[]) {
    return bridge().setTorrentFileSelection({ id, files })
}
