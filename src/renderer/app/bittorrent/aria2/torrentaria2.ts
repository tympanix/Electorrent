import { Torrent } from "@renderer/app/bittorrent/abstracttorrent"

function number(value: unknown) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

export class Aria2Torrent extends Torrent {
    readonly aria2Status: string
    readonly trackers: string[]

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
}
