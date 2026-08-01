import { Torrent } from "@renderer/app/bittorrent/abstracttorrent"
import { Column } from "@renderer/app/services/column"

function number(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

export class Aria2Torrent extends Torrent {
    readonly aria2Status: string
    readonly trackers: string[]
    readonly gid: string
    readonly connections: number
    readonly fileCount: number
    readonly numPieces: number
    readonly pieceLength: number
    readonly verifiedLength: number | undefined
    readonly verifyIntegrityPending: boolean
    readonly creationDate: number | undefined
    readonly mode: string

    constructor(data: Record<string, any>) {
        const total = number(data.totalLength)
        const completed = number(data.completedLength)
        const downloadSpeed = number(data.downloadSpeed)
        const remaining = Math.max(0, total - completed)
        const ratio = completed > 0 ? number(data.uploadLength) / completed : 0
        const percent = total > 0 ? completed / total * 1000 : 0
        const options = data.options && typeof data.options === "object" ? data.options : {}

        super({
            id: String(data.id || data.gid || ""),
            hash: typeof data.hash === "string" ? data.hash.toLowerCase() : String(data.gid || "").toLowerCase(),
            name: typeof data.name === "string" ? data.name : String(data.gid || "Unknown"),
            size: total,
            percent: number(percent),
            downloaded: completed,
            uploaded: number(data.uploadLength),
            ratio: number(ratio),
            ratioLimit: number(options["seed-ratio"]),
            uploadSpeed: number(data.uploadSpeed),
            downloadSpeed,
            uploadLimit: number(options["max-upload-limit"]),
            downloadLimit: number(options["max-download-limit"]),
            eta: number(downloadSpeed > 0 ? Math.ceil(remaining / downloadSpeed) : 0),
            peersConnected: number(data.peersConnected),
            peersInSwarm: number(data.peersInSwarm),
            seedsConnected: number(data.seedsConnected),
            seedsInSwarm: number(data.seedsInSwarm),
            torrentQueueOrder: number(data.queuePosition),
            statusMessage: typeof data.errorMessage === "string" ? data.errorMessage : "",
            dateAdded: number(data.dateAdded) || undefined,
            dateCompleted: number(data.dateCompleted) || undefined,
            savePath: typeof data.dir === "string" ? data.dir : "",
            props: {
                trackers: Array.isArray(data.trackers) ? data.trackers.join("\r\n") : "",
                gid: data.gid,
            },
        })
        this.aria2Status = typeof data.status === "string" ? data.status : "unknown"
        this.gid = typeof data.gid === "string" ? data.gid : this.id
        this.connections = number(data.connections)
        this.fileCount = number(data.fileCount)
        this.numPieces = number(data.numPieces)
        this.pieceLength = number(data.pieceLength)
        this.verifiedLength = data.verifiedLength == null ? undefined : number(data.verifiedLength)
        this.verifyIntegrityPending = data.verifyIntegrityPending === true
        this.creationDate = number(data.creationDate) || undefined
        this.mode = typeof data.mode === "string" ? data.mode : ""
        this.trackers = Array.isArray(data.trackers)
            ? data.trackers.filter((tracker): tracker is string => typeof tracker === "string" && tracker.length > 0)
            : []
    }

    isStatusError() { return this.aria2Status === "error" }
    isStatusPaused() { return false }
    isStatusQueued() { return this.aria2Status === "waiting" }
    isStatusCompleted() { return this.aria2Status === "complete" }
    isStatusDownloading() { return this.aria2Status === "active" && !this.isStatusSeeding() }
    isStatusSeeding() { return this.aria2Status === "active" && this.percent >= 1000 }
    isStatusStopped() { return this.aria2Status === "paused" || this.aria2Status === "removed" }

    static COL_GID = new Column({
        name: "GID",
        template: "{{torrent.gid}}",
        attribute: "gid",
        sort: Column.ALPHABETICAL,
    })

    static COL_STATUS = new Column({
        name: "Aria2 Status",
        template: "{{torrent.aria2Status}}",
        attribute: "aria2Status",
        sort: Column.ALPHABETICAL,
    })

    static COL_CONNECTIONS = new Column({
        name: "Connections",
        template: "{{torrent.connections | number}}",
        attribute: "connections",
    })

    static COL_FILES = new Column({
        name: "Files",
        template: "{{torrent.fileCount | number}}",
        attribute: "fileCount",
    })

    static COL_PIECES = new Column({
        name: "Pieces",
        template: "{{torrent.numPieces | number}}",
        attribute: "numPieces",
    })

    static COL_PIECE_SIZE = new Column({
        name: "Piece Size",
        template: "{{torrent.pieceLength | bytes}}",
        attribute: "pieceLength",
    })

    static COL_VERIFIED = new Column({
        name: "Verified",
        template: "{{torrent.verifiedLength | bytes}}",
        attribute: "verifiedLength",
    })

    static COL_CREATED_ON = new Column({
        name: "Created On",
        template: '<span time="torrent.creationDate"></span>',
        attribute: "creationDate",
    })

    static COL_MODE = new Column({
        name: "Torrent Mode",
        template: "{{torrent.mode}}",
        attribute: "mode",
        sort: Column.ALPHABETICAL,
    })
}
