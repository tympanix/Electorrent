import type { BittorrentRuntime } from "@main/lib/bittorrent/types"
import { HTTP_LOGIN_TIMEOUT } from "@main/lib/bittorrent/helpers"
import type {
    BittorrentFileSelection,
    BittorrentServerConfig,
    BittorrentTorrentDetailsData,
    BittorrentTorrentDetailsFile,
    BittorrentTorrentDetailsTracker,
    BittorrentTorrentPeer,
    TorrentClientConnection,
    TorrentUploadOptions,
} from "@shared/ipc-contract"
import type { TorrentActionItem } from "@shared/torrent-actions"
import { Aria2JsonRpcTransport, Aria2RpcError, type Aria2RpcCall } from "./json-rpc"

const TORRENT_FIELDS = [
    "gid", "status", "totalLength", "completedLength", "uploadLength",
    "downloadSpeed", "uploadSpeed", "connections", "numSeeders", "seeder",
    "dir", "files", "bittorrent", "infoHash", "verifiedLength", "verifyIntegrityPending",
    "pieceLength", "numPieces", "errorCode", "errorMessage", "followedBy",
]

const MAX_RESULTS = 2_147_483_647
const CHANGEABLE_STATUSES = new Set(["active", "waiting", "paused"])
const STOPPED_STATUSES = new Set(["complete", "error", "removed"])

interface Aria2TorrentData extends Record<string, unknown> {
    gid?: unknown
    status?: unknown
    bittorrent?: unknown
    following?: unknown
    followedBy?: unknown
}

interface TorrentSessionMetadata {
    dateAdded: number
    dateCompleted?: number
    completed: boolean
}

function finiteNumber(value: unknown): number {
    const parsed = typeof value === "number" ? value : Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

function boolean(value: unknown): boolean {
    return value === true || value === "true" || value === 1 || value === "1"
}

function nonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined
}

function infoHash(torrent: Aria2TorrentData): string | undefined {
    const directValue = nonEmptyString(torrent.infoHash)
    if (directValue) return directValue.toLowerCase()

    const bittorrent = torrent.bittorrent
    if (!bittorrent || typeof bittorrent !== "object") return undefined
    const value = nonEmptyString((bittorrent as Record<string, unknown>).infoHash)
    return value?.toLowerCase()
}

function torrentName(torrent: Aria2TorrentData): string {
    const bittorrent = torrent.bittorrent
    if (bittorrent && typeof bittorrent === "object") {
        const info = (bittorrent as Record<string, unknown>).info
        if (info && typeof info === "object") {
            const name = nonEmptyString((info as Record<string, unknown>).name)
            if (name) return name
        }
    }

    const files = torrent.files
    const firstFile = Array.isArray(files) && files[0]
    const path = firstFile && typeof firstFile === "object"
        ? nonEmptyString((firstFile as Record<string, unknown>).path)
        : undefined
    return path?.split(/[/\\]/).pop() || nonEmptyString(torrent.gid) || "Unknown"
}

function trackers(torrent: Aria2TorrentData): string[] {
    const bittorrent = torrent.bittorrent
    const announceList = bittorrent && typeof bittorrent === "object"
        ? (bittorrent as Record<string, unknown>).announceList
        : undefined
    if (!Array.isArray(announceList)) return []

    return [...new Set(announceList.flatMap((tier) => Array.isArray(tier) ? tier : [tier])
        .filter((tracker): tracker is string => typeof tracker === "string" && tracker.length > 0))]
}

function trackerDetails(torrent: Aria2TorrentData): BittorrentTorrentDetailsTracker[] {
    const bittorrent = torrent.bittorrent
    const announceList = bittorrent && typeof bittorrent === "object"
        ? (bittorrent as Record<string, unknown>).announceList
        : undefined
    if (!Array.isArray(announceList)) return []

    const seen = new Set<string>()
    return announceList.flatMap((tier, tierIndex) => {
        const values = Array.isArray(tier) ? tier : [tier]
        return values.flatMap((value) => {
            const url = nonEmptyString(value)
            if (!url || seen.has(url)) return []
            seen.add(url)
            return [{ url, tier: tierIndex }]
        })
    })
}

function optionalFiniteNumber(value: unknown): number | undefined {
    if (value === undefined || value === null || value === "") return undefined
    const parsed = typeof value === "number" ? value : Number(value)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function peerClient(peerId: unknown): string {
    const encoded = nonEmptyString(peerId)
    if (!encoded) return ""

    try {
        return decodeURIComponent(encoded)
    } catch {
        return encoded.replace(/%([0-9a-f]{2})/gi, (_match, hex: string) => {
            const byte = Number.parseInt(hex, 16)
            return byte >= 0x20 && byte <= 0x7e ? String.fromCharCode(byte) : "�"
        })
    }
}

function bitfieldProgress(bitfield: unknown, numPieces: unknown): number {
    const pieces = optionalFiniteNumber(numPieces)
    if (!pieces || pieces <= 0 || typeof bitfield !== "string") return 0
    const normalized = bitfield.trim()
    if (!/^[0-9a-f]*$/i.test(normalized)) return 0

    let populated = 0
    for (const digit of normalized) {
        let value = Number.parseInt(digit, 16)
        while (value > 0) {
            populated += value & 1
            value >>= 1
        }
    }
    return Math.max(0, Math.min(1, Math.min(populated, Math.floor(pieces)) / pieces))
}

function integerOption(value: unknown, multiplier = 1): string | undefined {
    if (value === undefined || value === null || value === "") return undefined
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) return undefined
    return String(Math.floor(parsed * multiplier))
}

function optionNumber(value: unknown): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0
    if (typeof value !== "string") return 0
    const match = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*([kmgt])?b?$/i)
    if (!match) return 0
    const units: Record<string, number> = { k: 1024, m: 1024 ** 2, g: 1024 ** 3, t: 1024 ** 4 }
    return Number(match[1]) * (match[2] ? units[match[2].toLowerCase()] : 1)
}

function compactFileSelection(indices: number[]): string {
    const values = [...new Set(indices.filter((index) => Number.isInteger(index) && index >= 0))]
        .sort((left, right) => left - right)
        .map((index) => index + 1)
    const ranges: string[] = []

    for (let offset = 0; offset < values.length;) {
        const start = values[offset]
        let end = start
        while (offset + 1 < values.length && values[offset + 1] === end + 1) {
            end = values[++offset]
        }
        ranges.push(start === end ? String(start) : `${start}-${end}`)
        offset += 1
    }

    return ranges.join(",")
}

function relativeFilePath(path: string, directory: string | undefined): string {
    const normalizedPath = path.replace(/\\/g, "/")
    const normalizedDirectory = directory?.replace(/\\/g, "/").replace(/\/+$/, "")
    if (!normalizedDirectory) return normalizedPath
    return normalizedPath.startsWith(`${normalizedDirectory}/`)
        ? normalizedPath.slice(normalizedDirectory.length + 1)
        : normalizedPath
}

function aria2Options(options?: TorrentUploadOptions): Record<string, string> {
    if (!options) return {}

    const selectedFiles = options.fileSelection
        ? compactFileSelection(options.fileSelection.filter((file) => file.wanted).map((file) => file.index))
        : undefined

    const result: Record<string, string | undefined> = {
        dir: nonEmptyString(options.saveLocation),
        pause: options.startTorrent === undefined ? undefined : String(!options.startTorrent),
        "bt-max-peers": integerOption(options.peerLimit),
        "check-integrity": options.skipCheck === undefined ? undefined : String(!options.skipCheck),
        "bt-prioritize-piece": options.firstAndLastPiecePrio ? "head,tail" : undefined,
        "max-download-limit": integerOption(options.downloadSpeedLimit, 1024),
        "max-upload-limit": integerOption(options.uploadSpeedLimit, 1024),
        "select-file": selectedFiles,
    }

    return Object.fromEntries(Object.entries(result)
        .filter((entry): entry is [string, string] => entry[1] !== undefined))
}

function preference(torrent: Aria2TorrentData, followedGids: Set<string>): number {
    const gid = nonEmptyString(torrent.gid) || ""
    const status = nonEmptyString(torrent.status)
    return (followedGids.has(gid) ? 100 : 0)
        + (status === "active" ? 20 : status === "waiting" || status === "paused" ? 10 : 0)
        + (torrent.bittorrent ? 1 : 0)
}

export class Aria2Runtime implements BittorrentRuntime {
    readonly actions: TorrentActionItem[] = [
        { role: "details", label: "Details", icon: "info circle" },
        { role: "files", label: "Files", icon: "file" },
        { role: "set-speed-limits", label: "Set Speed Limits", icon: "dashboard" },
        { role: "set-ratio", label: "Set Ratio", icon: "percent" },
        { label: "Start", action: "resume", icon: "play" },
        { label: "Pause", action: "pause", icon: "pause" },
        { role: "delete", label: "Remove", action: "remove", icon: "remove" },
    ]

    private rpc?: Aria2JsonRpcTransport
    private gidByHash = new Map<string, string>()
    private statusByGid = new Map<string, string>()
    private selectedFilesByHash = new Map<string, Set<number>>()
    private dirByHash = new Map<string, string>()
    private sessionMetadata = new Map<string, TorrentSessionMetadata>()
    private identityByGid = new Map<string, string>()

    async connect(server: BittorrentServerConfig): Promise<TorrentClientConnection> {
        this.rpc = new Aria2JsonRpcTransport(server)
        this.gidByHash.clear()
        this.statusByGid.clear()
        this.selectedFilesByHash.clear()
        this.dirByHash.clear()
        this.sessionMetadata.clear()
        this.identityByGid.clear()
        const result = await this.rpc.call<{ version?: string }>("aria2.getVersion", [], HTTP_LOGIN_TIMEOUT)
        if (typeof result?.version !== "string" || !result.version.trim()) {
            throw new Error("aria2 did not return its version")
        }

        return {
            version: `aria2 ${result.version.trim()}`,
            features: {
                magnetLinks: true,
                fileSelection: true,
                uploadFileSelection: true,
                torrentDetails: true,
                torrentPeers: true,
                trackerFilter: true,
                speedLimits: true,
                ratioLimits: true,
                uploadOptions: {
                    saveLocation: true,
                    startTorrent: true,
                    peerLimit: true,
                    skipCheck: true,
                    firstAndLastPiecePrio: true,
                    downloadSpeedLimit: true,
                    uploadSpeedLimit: true,
                },
            },
        }
    }

    async getSnapshot(): Promise<{ torrents: unknown[], globalStat: Record<string, number> }> {
        const calls: Aria2RpcCall[] = [
            { method: "aria2.tellActive", params: [TORRENT_FIELDS] },
            { method: "aria2.tellWaiting", params: [0, MAX_RESULTS, TORRENT_FIELDS] },
            { method: "aria2.tellStopped", params: [0, MAX_RESULTS, TORRENT_FIELDS] },
            { method: "aria2.getGlobalStat" },
        ]
        const [active, waiting, stopped, globalStat] = await this.client().multicall<unknown>(calls)
        const groups = [active, waiting, stopped]
        const rawTorrents = groups.flatMap((group, groupIndex) => (Array.isArray(group) ? group : [])
            .filter((torrent): torrent is Aria2TorrentData => Boolean(torrent) && typeof torrent === "object")
            .map((torrent, index) => ({
                ...torrent,
                _queuePosition: groupIndex === 1 ? index : -1,
            })))

        const optionResults = rawTorrents.length === 0
            ? []
            : await this.client().multicall<Record<string, unknown>>(rawTorrents.map((torrent) => ({
                method: "aria2.getOption",
                params: [torrent.gid],
            })))
        const withOptions = rawTorrents.map((torrent, index) => ({ ...torrent, options: optionResults[index] || {} }))
        const followedGids = new Set(withOptions.flatMap((torrent) => Array.isArray(torrent.followedBy)
            ? torrent.followedBy.filter((gid): gid is string => typeof gid === "string")
            : []))
        const presentGids = new Set(withOptions.map((torrent) => nonEmptyString(torrent.gid)).filter((gid): gid is string => Boolean(gid)))
        const candidates = withOptions.filter((torrent) => {
            const children = Array.isArray(torrent.followedBy) ? torrent.followedBy : []
            return !children.some((gid) => typeof gid === "string" && presentGids.has(gid))
        })
        const byIdentity = new Map<string, Aria2TorrentData>()
        for (const torrent of candidates) {
            const gid = nonEmptyString(torrent.gid)
            if (!gid) continue
            const identity = infoHash(torrent) || gid.toLowerCase()
            const existing = byIdentity.get(identity)
            if (!existing || preference(torrent, followedGids) > preference(existing, followedGids)) {
                byIdentity.set(identity, torrent)
            }
        }

        const observedAt = Date.now()
        const predecessorIdentityByGid = new Map<string, string>()
        for (const torrent of withOptions) {
            const gid = nonEmptyString(torrent.gid)
            if (!gid || !Array.isArray(torrent.followedBy)) continue
            const identity = infoHash(torrent) || gid.toLowerCase()
            for (const childGid of torrent.followedBy) {
                if (typeof childGid === "string") predecessorIdentityByGid.set(childGid.toLowerCase(), identity)
            }
        }

        const nextSessionMetadata = new Map<string, TorrentSessionMetadata>()
        const nextIdentityByGid = new Map<string, string>()

        this.gidByHash = new Map()
        this.statusByGid = new Map()
        this.dirByHash = new Map()
        const torrents = [...byIdentity.entries()].map(([hash, torrent]) => {
            const gid = String(torrent.gid)
            const normalizedGid = gid.toLowerCase()
            const status = nonEmptyString(torrent.status) || "unknown"
            const totalLength = finiteNumber(torrent.totalLength)
            const completedLength = finiteNumber(torrent.completedLength)
            const connections = finiteNumber(torrent.connections)
            const numSeeders = finiteNumber(torrent.numSeeders)
            const knownPeers = Math.max(connections, numSeeders)
            const isCompleted = status === "complete" || (totalLength > 0 && completedLength >= totalLength)
            const metadataKeys = [
                hash,
                this.identityByGid.get(normalizedGid),
                predecessorIdentityByGid.get(normalizedGid),
            ].filter((key): key is string => Boolean(key))
            const previousMetadata = metadataKeys
                .map((key) => this.sessionMetadata.get(key))
                .filter((metadata): metadata is TorrentSessionMetadata => Boolean(metadata))
            const dateAdded = previousMetadata.length > 0
                ? Math.min(...previousMetadata.map((metadata) => metadata.dateAdded))
                : observedAt
            const previousCompletion = previousMetadata
                .filter((metadata) => metadata.completed && metadata.dateCompleted !== undefined)
                .map((metadata) => metadata.dateCompleted as number)
            const dateCompleted = isCompleted
                ? (previousCompletion.length > 0 ? Math.min(...previousCompletion) : observedAt)
                : undefined
            nextSessionMetadata.set(hash, { dateAdded, dateCompleted, completed: isCompleted })
            nextIdentityByGid.set(normalizedGid, hash)
            this.gidByHash.set(hash, gid)
            this.statusByGid.set(gid, status)
            this.dirByHash.set(hash, nonEmptyString(torrent.dir) || "")

            return {
                hash,
                gid,
                status,
                name: torrentName(torrent),
                totalLength,
                completedLength,
                uploadLength: finiteNumber(torrent.uploadLength),
                downloadSpeed: finiteNumber(torrent.downloadSpeed),
                uploadSpeed: finiteNumber(torrent.uploadSpeed),
                peersConnected: connections,
                peersInSwarm: knownPeers,
                seedsConnected: numSeeders,
                seedsInSwarm: knownPeers,
                dateAdded,
                dateCompleted,
                seeder: boolean(torrent.seeder),
                dir: nonEmptyString(torrent.dir) || "",
                trackers: trackers(torrent),
                queuePosition: finiteNumber(torrent._queuePosition),
                verifiedLength: finiteNumber(torrent.verifiedLength),
                verifyIntegrityPending: boolean(torrent.verifyIntegrityPending),
                errorMessage: nonEmptyString(torrent.errorMessage) || "",
                options: torrent.options && typeof torrent.options === "object" ? torrent.options : {},
            }
        })
        for (const [gid, predecessorIdentity] of predecessorIdentityByGid) {
            if (!nextIdentityByGid.has(gid) && nextSessionMetadata.has(predecessorIdentity)) {
                nextIdentityByGid.set(gid, predecessorIdentity)
            }
        }
        this.sessionMetadata = nextSessionMetadata
        this.identityByGid = nextIdentityByGid
        const stats = globalStat && typeof globalStat === "object" ? globalStat as Record<string, unknown> : {}

        return {
            torrents,
            globalStat: Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, finiteNumber(value)])),
        }
    }

    async addTorrentUrl(uri: string, options?: TorrentUploadOptions): Promise<void> {
        await this.client().call("aria2.addUri", [[uri], aria2Options(options)])
    }

    async uploadTorrent(buffer: Uint8Array, _filename: string, options?: TorrentUploadOptions): Promise<void> {
        await this.client().call("aria2.addTorrent", [Buffer.from(buffer).toString("base64"), [], aria2Options(options)])
    }

    async getTorrentDetails(hash: string): Promise<BittorrentTorrentDetailsData> {
        const gid = this.resolveGids([hash])[0]
        const [status, options] = await this.client().multicall<Record<string, unknown>>([
            { method: "aria2.tellStatus", params: [gid, TORRENT_FIELDS] },
            { method: "aria2.getOption", params: [gid] },
        ])
        const data = status || {}
        const torrentOptions = options || {}
        const completedLength = finiteNumber(data.completedLength)
        const uploadLength = finiteNumber(data.uploadLength)

        return {
            info: {
                hash: infoHash(data) || hash.toLowerCase(),
                savePath: nonEmptyString(data.dir) || null,
                totalSize: finiteNumber(data.totalLength),
                totalDownloaded: completedLength,
                totalUploaded: uploadLength,
                shareRatio: completedLength > 0 ? uploadLength / completedLength : 0,
                ratioLimit: optionNumber(torrentOptions["seed-ratio"]),
                downloadSpeed: finiteNumber(data.downloadSpeed),
                uploadSpeed: finiteNumber(data.uploadSpeed),
                downloadLimit: optionNumber(torrentOptions["max-download-limit"]),
                uploadLimit: optionNumber(torrentOptions["max-upload-limit"]),
                pieceSize: finiteNumber(data.pieceLength),
                piecesTotal: finiteNumber(data.numPieces),
                verifiedLength: optionalFiniteNumber(data.verifiedLength) ?? null,
                verifyIntegrityPending: data.verifyIntegrityPending === undefined
                    ? null
                    : boolean(data.verifyIntegrityPending),
                errorCode: nonEmptyString(data.errorCode) || null,
                errorString: nonEmptyString(data.errorMessage) || null,
                connections: finiteNumber(data.connections),
                connectionsLimit: finiteNumber(torrentOptions["bt-max-peers"]),
            },
        }
    }

    async getTorrentFiles(hash: string): Promise<BittorrentTorrentDetailsFile[]> {
        const gid = this.resolveGids([hash])[0]
        const [files, status] = await this.client().multicall<unknown>([
            { method: "aria2.getFiles", params: [gid] },
            { method: "aria2.tellStatus", params: [gid, ["gid", "status", "dir", "bittorrent", "infoHash", "followedBy"]] },
        ])
        const context = status && typeof status === "object" ? status as Aria2TorrentData : {}
        this.rememberDownloadState(hash, context, gid)
        const directory = nonEmptyString(context.dir) || this.dirByHash.get(hash.toLowerCase())
        const selectedOverride = this.selectedFilesByHash.get(hash.toLowerCase())
        return (Array.isArray(files) ? files : []).flatMap((value) => {
            if (!value || typeof value !== "object") return []
            const file = value as Record<string, unknown>
            const aria2Index = Number(file.index)
            if (!Number.isInteger(aria2Index) || aria2Index < 1) return []
            const path = relativeFilePath(
                typeof file.path === "string" ? file.path : "",
                directory,
            )
            const size = finiteNumber(file.length)
            const completed = finiteNumber(file.completedLength)
            return [{
                index: aria2Index - 1,
                path,
                name: path.split(/[/\\]/).pop() || path,
                size,
                progress: size > 0 ? Math.max(0, Math.min(1, completed / size)) : 0,
                wanted: selectedOverride ? selectedOverride.has(aria2Index - 1) : boolean(file.selected),
            }]
        })
    }

    async getTorrentPeers(hash: string): Promise<BittorrentTorrentPeer[]> {
        const gid = this.resolveGids([hash])[0]
        const [peers, status] = await this.client().multicall<unknown>([
            { method: "aria2.getPeers", params: [gid] },
            { method: "aria2.tellStatus", params: [gid, ["numPieces"]] },
        ])
        const torrentStatus = status && typeof status === "object" ? status as Record<string, unknown> : {}

        return (Array.isArray(peers) ? peers : []).flatMap((value) => {
            if (!value || typeof value !== "object") return []
            const peer = value as Record<string, unknown>
            const port = optionalFiniteNumber(peer.port)
            return [{
                ip: nonEmptyString(peer.ip) || "",
                port: port && port > 0 ? port : undefined,
                client: peerClient(peer.peerId),
                progress: bitfieldProgress(peer.bitfield, torrentStatus.numPieces),
                downloadSpeed: finiteNumber(peer.downloadSpeed),
                uploadSpeed: finiteNumber(peer.uploadSpeed),
                flags: [
                    boolean(peer.seeder) ? "S" : "",
                    boolean(peer.amChoking) ? "C" : "",
                    boolean(peer.peerChoking) ? "c" : "",
                ].join("") || undefined,
            }]
        })
    }

    async getTorrentTrackers(hash: string): Promise<BittorrentTorrentDetailsTracker[]> {
        const gid = this.resolveGids([hash])[0]
        const status = await this.client().call<unknown>("aria2.tellStatus", [gid, ["bittorrent"]])
        return trackerDetails(status && typeof status === "object" ? status as Aria2TorrentData : {})
    }

    async setTorrentFileSelection(hash: string, files: BittorrentFileSelection[]): Promise<void> {
        const normalizedHash = hash.toLowerCase()
        const wantedByIndex = new Map(files.map((file) => [file.index, file.wanted]))
        const currentFiles = await this.getTorrentFiles(hash)
        const selectedIndices = currentFiles
            .filter((file) => wantedByIndex.get(file.index) ?? file.wanted)
            .map((file) => file.index)
        this.selectedFilesByHash.set(normalizedHash, new Set(selectedIndices))
        if (currentFiles.length > 1) {
            await this.changeFileSelection(normalizedHash, compactFileSelection(selectedIndices))
        }
    }

    async setSpeedLimits(hashes: string[], options: Record<string, unknown>): Promise<void> {
        const changedOptions: Record<string, string> = {}
        const downloadLimit = integerOption(options.downloadSpeedLimit, 1024)
        const uploadLimit = integerOption(options.uploadSpeedLimit, 1024)
        if (downloadLimit !== undefined) changedOptions["max-download-limit"] = downloadLimit
        if (uploadLimit !== undefined) changedOptions["max-upload-limit"] = uploadLimit
        await this.changeOptions(hashes, changedOptions)
    }

    async setRatioLimit(hashes: string[], options: Record<string, unknown>): Promise<void> {
        const ratioLimit = Number(options.ratioLimit)
        if (!Number.isFinite(ratioLimit) || ratioLimit < 0) throw new Error("Ratio limit must be zero or greater")
        await this.changeOptions(hashes, { "seed-ratio": String(ratioLimit) })
    }

    async resume(hashes: string[]): Promise<void> {
        await this.forHashes("aria2.unpause", hashes, new Set(["paused"]))
    }

    async resumeAll(): Promise<void> {
        await this.client().call("aria2.unpauseAll")
    }

    async pause(hashes: string[]): Promise<void> {
        await this.forHashes("aria2.pause", hashes, new Set(["active", "waiting"]))
    }

    async pauseAll(): Promise<void> {
        await this.client().call("aria2.pauseAll")
    }

    async remove(hashes: string[]): Promise<void> {
        const resolvedGids = this.resolveGids(hashes)
        const statuses = await this.client().multicall<Aria2TorrentData>(resolvedGids.map((gid) => ({
            method: "aria2.tellStatus",
            params: [gid, ["gid", "following"]],
        })))
        const gids = [...new Set(statuses.flatMap((status, index) => {
            const gid = nonEmptyString(status.gid) || resolvedGids[index]
            const following = nonEmptyString(status.following)
            return following ? [gid, following] : [gid]
        }))]
        await this.ignoreMissing(this.client().multicall(gids.map((gid) => ({ method: "aria2.remove", params: [gid] }))))
        await this.removeDownloadResults(gids)
        hashes.forEach((hash) => this.selectedFilesByHash.delete(hash.toLowerCase()))
    }

    private client() {
        if (!this.rpc) throw new Error("aria2 is not connected")
        return this.rpc
    }

    private resolveGids(hashes: string[]): string[] {
        return [...new Set(hashes.map((hash) => {
            const gid = this.gidByHash.get(hash.toLowerCase())
            if (!gid) throw new Error(`aria2 download is no longer available: ${hash}`)
            return gid
        }))]
    }

    private async forHashes(method: string, hashes: string[], statuses: Set<string>) {
        const gids = this.resolveGids(hashes).filter((gid) => statuses.has(this.statusByGid.get(gid) || ""))
        await this.client().multicall(gids.map((gid) => ({ method, params: [gid] })))
    }

    private async changeOptions(hashes: string[], options: Record<string, string>) {
        if (Object.keys(options).length === 0) return
        const gids = this.resolveGids(hashes)
        await this.client().multicall(gids.map((gid) => ({
            method: "aria2.changeOption",
            params: [gid, options],
        })))
    }

    private async changeFileSelection(hash: string, selection: string): Promise<void> {
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const gid = this.gidByHash.get(hash)
            if (!gid) return

            let status = this.statusByGid.get(gid) || ""
            if (!CHANGEABLE_STATUSES.has(status) && !STOPPED_STATUSES.has(status)) {
                const current = await this.refreshDownloadState(hash, gid)
                if (!current) return
                status = current.status
            }
            if (STOPPED_STATUSES.has(status)) return
            if (!CHANGEABLE_STATUSES.has(status)) {
                throw new Error(`aria2 download has unsupported status for file selection: ${status || "unknown"}`)
            }

            try {
                await this.client().call("aria2.changeOption", [gid, { "select-file": selection }])
                return
            } catch (error) {
                if (this.isMissingGid(error)) {
                    this.forgetGid(hash, gid)
                    return
                }
                if (!this.isCannotChangeOption(error)) throw error

                const current = await this.refreshDownloadState(hash, gid)
                if (!current || STOPPED_STATUSES.has(current.status)) return
                if (current.gid === gid && current.status === status) throw error
            }
        }

        throw new Error(`aria2 download kept changing GID while updating file selection: ${hash}`)
    }

    private async refreshDownloadState(hash: string, gid: string): Promise<{ gid: string, status: string } | undefined> {
        let current: Aria2TorrentData
        try {
            current = await this.client().call<Aria2TorrentData>("aria2.tellStatus", [
                gid,
                ["gid", "status", "bittorrent", "infoHash", "followedBy"],
            ])
        } catch (error) {
            if (!this.isMissingGid(error)) throw error
            this.forgetGid(hash, gid)
            return undefined
        }

        const followedBy = Array.isArray(current.followedBy)
            ? current.followedBy.filter((child): child is string => typeof child === "string" && child.length > 0)
            : []
        if (followedBy.length > 0) {
            const children = await this.client().multicall<Aria2TorrentData>(followedBy.map((childGid) => ({
                method: "aria2.tellStatus",
                params: [childGid, ["gid", "status", "bittorrent", "infoHash", "followedBy"]],
            })))
            const child = children.find((candidate) => infoHash(candidate) === hash)
                || children.find((candidate) => CHANGEABLE_STATUSES.has(nonEmptyString(candidate.status) || ""))
                || children[0]
            if (child) current = child
        }

        return this.rememberDownloadState(hash, current, gid)
    }

    private rememberDownloadState(hash: string, torrent: Aria2TorrentData, previousGid: string): { gid: string, status: string } {
        const gid = nonEmptyString(torrent.gid) || previousGid
        const status = nonEmptyString(torrent.status) || this.statusByGid.get(gid) || "unknown"
        if (gid !== previousGid) this.statusByGid.delete(previousGid)
        this.gidByHash.set(hash.toLowerCase(), gid)
        this.statusByGid.set(gid, status)
        return { gid, status }
    }

    private forgetGid(hash: string, gid: string): void {
        if (this.gidByHash.get(hash) === gid) this.gidByHash.delete(hash)
        this.statusByGid.delete(gid)
    }

    private isCannotChangeOption(error: unknown): error is Aria2RpcError {
        return error instanceof Aria2RpcError
            && error.code === 1
            && /^Cannot change option for GID#[0-9a-f]+$/i.test(error.message)
    }

    private isMissingGid(error: unknown): error is Aria2RpcError {
        return error instanceof Aria2RpcError
            && error.code === 1
            && /^(?:GID [0-9a-f]+ is not found|No such download for GID#[0-9a-f]+)$/i.test(error.message)
    }

    private async ignoreMissing(operation: Promise<unknown>): Promise<void> {
        try {
            await operation
        } catch (error) {
            if (!(error instanceof Aria2RpcError) || error.code !== 1) throw error
        }
    }

    private async removeDownloadResults(gids: string[]): Promise<void> {
        for (let attempt = 0; attempt < 20; attempt += 1) {
            try {
                await this.client().multicall(gids.map((gid) => ({ method: "aria2.removeDownloadResult", params: [gid] })))
                return
            } catch (error) {
                if (!(error instanceof Aria2RpcError) || error.code !== 1) throw error
                if (attempt === 19) return
                await new Promise((resolve) => setTimeout(resolve, 250))
            }
        }
    }
}

export { Aria2JsonRpcTransport, Aria2RpcError } from "./json-rpc"
