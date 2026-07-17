import type {
    BittorrentTorrentDetailsData,
    ElectorrentBridge,
    BittorrentFileSelection,
    BittorrentServerConfig,
    TorrentClientConnection,
    TorrentUploadOptions,
} from "@shared/ipc-contract"
import type {
    BittorrentActionArguments,
    BittorrentActionName,
    BittorrentInvokeActionRequest,
} from "@shared/bittorrent-actions"

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

export function invokeAction<Action extends BittorrentActionName>(
    action: Action,
    hashes: string[] = [],
    ...args: BittorrentActionArguments[Action]
) {
    return bridge().invokeAction({ action, hashes, args } as BittorrentInvokeActionRequest)
}

export function getTorrentDetails(hash: string): Promise<BittorrentTorrentDetailsData> {
    return bridge().getTorrentDetails({ hash })
}

export function getTorrentFiles(hash: string) {
    return bridge().getTorrentFiles({ hash })
}

export function setTorrentFileSelection(hash: string, files: BittorrentFileSelection[]) {
    return bridge().setTorrentFileSelection({ hash, files })
}
