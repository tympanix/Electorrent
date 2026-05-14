import type {
    BittorrentFileSelection,
    BittorrentServerConfig,
} from "../../../shared/ipc-contract"
import type { TorrentUploadOptions } from "./torrentclient"

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

export function connect(server: any) {
    return bridge().connect(serializeServer(server))
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

export function uploadTorrent(data: Uint8Array, filename: string, options?: TorrentUploadOptions) {
    return bridge().uploadTorrent({ data, filename, options })
}

export function invokeAction(action: string, hashes: string[] = [], ...args: any[]) {
    return bridge().invokeAction({ action, hashes, args })
}

export function getTorrentFiles(hash: string) {
    return bridge().getTorrentFiles({ hash })
}

export function setTorrentFileSelection(hash: string, files: BittorrentFileSelection[]) {
    return bridge().setTorrentFileSelection({ hash, files })
}
