import { TorrentActionList, TorrentClient, TorrentDetailsInfoSection, TorrentRatioLimitOptions, TorrentSpeedLimitOptions, TorrentUpdates, TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { Torrent } from "@renderer/app/bittorrent/abstracttorrent";
import { DelugeTorrent } from "./torrentd";
import { addTorrentUrl, getSnapshot, getTorrentDetails, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";
import type { BittorrentTorrentDetailsData } from "@shared/ipc-contract";
import { applyFreeDiskSpace } from "@renderer/app/bittorrent/free-disk-space";

export class DelugeClient extends TorrentClient<DelugeTorrent> {
    public name = 'Deluge'
    public id = 'deluge'
    async torrents(): Promise<TorrentUpdates> {
        const data: Record<string, any> = await getSnapshot()

        return applyFreeDiskSpace({
            labels: Array.isArray(data.labels) ? data.labels : [],
            all: Object.keys(data.torrents || {}).map((hash) => new DelugeTorrent(hash, data.torrents[hash])),
            changed: [],
            deleted: [],
            dirty: true,
        }, data.freeDiskSpace)
    }

    defaultPath(): string {
      return "/"
    }

    addTorrentUrl(magnet: string, options?: TorrentUploadOptions): Promise<void> {
        return addTorrentUrl(magnet, options)
    }

    uploadTorrent(buffer: Uint8Array, filename: string, options?: TorrentUploadOptions, sourcePath?: string): Promise<void> {
        return uploadTorrent(buffer, filename, options, sourcePath)
    }

    resume(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("resume", torrents.map((torrent) => torrent.id))
    }

    pause(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("pause", torrents.map((torrent) => torrent.id))
    }

    verify(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("verify", torrents.map((torrent) => torrent.id))
    }

    remove(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("remove", torrents.map((torrent) => torrent.id))
    }

    removeAndDelete(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("removeAndDelete", torrents.map((torrent) => torrent.id))
    }

    queueUp(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueUp", torrents.map((torrent) => torrent.id))
    }

    queueDown(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueDown", torrents.map((torrent) => torrent.id))
    }

    queueTop(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueTop", torrents.map((torrent) => torrent.id))
    }

    queueBottom(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueBottom", torrents.map((torrent) => torrent.id))
    }

    setLabel(torrents: DelugeTorrent[], label: string, create?: boolean): Promise<void> {
        return invokeAction("setLabel", torrents.map((torrent) => torrent.id), label, create)
    }

    deleteTorrents(torrents: DelugeTorrent[]): Promise<void> {
        return this.remove(torrents)
    }

    setSpeedLimits(torrents: DelugeTorrent[], options: TorrentSpeedLimitOptions): Promise<void> {
        return invokeAction("setSpeedLimits", torrents.map((torrent) => torrent.id), options)
    }

    setRatioLimit(torrents: DelugeTorrent[], options: TorrentRatioLimitOptions): Promise<void> {
        return invokeAction("setRatioLimit", torrents.map((torrent) => torrent.id), options)
    }

    protected getTorrentDetailsData(torrent: DelugeTorrent): Promise<BittorrentTorrentDetailsData> {
        return getTorrentDetails(torrent.id)
    }

    protected getTorrentDetailsInfoSections(torrent: DelugeTorrent, details: BittorrentTorrentDetailsData): TorrentDetailsInfoSection[] {
        const info = this.getTorrentDetailsInfo(details)
        const toSpeedLimitBytes = (value: unknown) => {
            const limit = this.toNumber(value)
            return limit == null ? null : (limit < 0 ? -1 : limit * 1024)
        }

        return this.compactTorrentDetailsSections([
            this.createTorrentDetailsSection("overview", "Overview", [
                this.createTorrentDetailsField("name", "Name", torrent.name),
                this.createTorrentDetailsField("hash", "Hash", torrent.hash),
                this.createTorrentDetailsField("status", "Status", torrent.statusText()),
                this.createTorrentDetailsField("save-path", "Save Path", info.savePath as string | null, "path"),
                this.createTorrentDetailsField("total-size", "Total Size", this.toNumber(info.totalSize) ?? torrent.size, "bytes"),
                this.createTorrentDetailsField("files", "Files", this.toNumber(info.numFiles), "number"),
                this.createTorrentDetailsField("storage-mode", "Storage Mode", info.storageMode as string | null),
                this.createTorrentDetailsField("auto-managed", "Auto Managed", info.autoManaged as boolean | null, "boolean"),
            ]),
            this.createTorrentDetailsSection("transfer", "Transfer", [
                this.createTorrentDetailsField("downloaded", "Downloaded", this.toNumber(info.totalDownloaded) ?? torrent.downloaded, "bytes"),
                this.createTorrentDetailsField("uploaded", "Uploaded", this.toNumber(info.totalUploaded) ?? torrent.uploaded, "bytes"),
                this.createTorrentDetailsField("ratio", "Share Ratio", this.toNumber(info.shareRatio) ?? torrent.ratio, "ratio"),
                this.createTorrentDetailsField("ratio-limit", "Ratio Limit", this.toNumber(info.ratioLimit) ?? torrent.ratioLimit, "ratio"),
                this.createTorrentDetailsField("download-speed", "Download Speed", this.toNumber(info.downloadSpeed) ?? torrent.downloadSpeed, "speed"),
                this.createTorrentDetailsField("upload-speed", "Upload Speed", this.toNumber(info.uploadSpeed) ?? torrent.uploadSpeed, "speed"),
                this.createTorrentDetailsField("download-limit", "Download Limit", toSpeedLimitBytes(info.downloadLimit), "speedLimit", { allowEmpty: true }),
                this.createTorrentDetailsField("upload-limit", "Upload Limit", toSpeedLimitBytes(info.uploadLimit), "speedLimit", { allowEmpty: true }),
                this.createTorrentDetailsField("eta", "ETA", this.toEpochSeconds(info.eta), "eta"),
                this.createTorrentDetailsField("active-time", "Active Time", this.toNumber(info.timeElapsed), "number"),
                this.createTorrentDetailsField("seeding-time", "Seeding Time", this.toNumber(info.seedingTime), "number"),
                this.createTorrentDetailsField("finished-time", "Finished Time", this.toNumber(info.finishedTime), "number"),
                this.createTorrentDetailsField("remaining", "Remaining", this.toNumber(info.totalRemaining), "bytes"),
                this.createTorrentDetailsField("payload-downloaded", "Payload Downloaded", this.toNumber(info.payloadDownloaded), "bytes"),
                this.createTorrentDetailsField("payload-uploaded", "Payload Uploaded", this.toNumber(info.payloadUploaded), "bytes"),
                this.createTorrentDetailsField("all-time-downloaded", "All-time Downloaded", this.toNumber(info.allTimeDownloaded), "bytes"),
            ]),
            this.createTorrentDetailsSection("swarm", "Swarm", [
                this.createTorrentDetailsField("seeds", "Connected Seeds", this.toNumber(info.seeds), "number"),
                this.createTorrentDetailsField("seeds-total", "Total Seeds", this.toNumber(info.seedsTotal), "number"),
                this.createTorrentDetailsField("peers", "Connected Peers", this.toNumber(info.peers), "number"),
                this.createTorrentDetailsField("peers-total", "Total Peers", this.toNumber(info.peersTotal), "number"),
                this.createTorrentDetailsField("connections-limit", "Peer Limit", this.toNumber(info.connectionsLimit), "number"),
                this.createTorrentDetailsField("copies", "Distributed Copies", this.toNumber(info.distributedCopies), "number"),
                this.createTorrentDetailsField("seed-peer-ratio", "Seed/Peer Ratio", this.toNumber(info.seedsPeersRatio), "ratio"),
                this.createTorrentDetailsField("tracker", "Tracker", info.trackerHost as string | null),
                this.createTorrentDetailsField("tracker-url", "Tracker URL", info.tracker as string | null, "path"),
                this.createTorrentDetailsField("tracker-status", "Tracker Status", info.trackerStatus as string | null),
                this.createTorrentDetailsField("next-announce", "Next Announce", this.toNumber(info.nextAnnounce), "eta"),
            ]),
            this.createTorrentDetailsSection("content", "Content", [
                this.createTorrentDetailsField("piece-size", "Piece Size", this.toNumber(info.pieceSize), "bytes"),
                this.createTorrentDetailsField("pieces", "Pieces", this.toNumber(info.piecesTotal), "number"),
                this.createTorrentDetailsField("owner", "Owner", info.owner as string | null),
                this.createTorrentDetailsField("super-seeding", "Super Seeding", info.superSeeding as boolean | null, "boolean"),
                this.createTorrentDetailsField("seed-rank", "Seed Rank", this.toNumber(info.seedRank), "number"),
                this.createTorrentDetailsField("max-upload-slots", "Upload Slot Limit", this.toNumber(info.maxUploadSlots), "number"),
                this.createTorrentDetailsField("private", "Private", info.private as boolean | null, "boolean"),
                this.createTorrentDetailsField("seed-mode", "Seed Mode", info.seedMode as boolean | null, "boolean"),
                this.createTorrentDetailsField("finished", "Finished", info.finished as boolean | null, "boolean"),
                this.createTorrentDetailsField("seed", "Seed", info.seed as boolean | null, "boolean"),
                this.createTorrentDetailsField("sequential", "Sequential Download", info.sequentialDownload as boolean | null, "boolean"),
                this.createTorrentDetailsField("first-last-priority", "Prioritize First/Last Pieces", info.prioritizeFirstLast as boolean | null, "boolean"),
                this.createTorrentDetailsField("move-completed", "Move Completed", info.moveCompleted as boolean | null, "boolean"),
                this.createTorrentDetailsField("move-completed-path", "Move Completed Path", info.moveCompletedPath as string | null, "path"),
                this.createTorrentDetailsField("shared", "Shared", info.shared as boolean | null, "boolean"),
                this.createTorrentDetailsField("remove-at-ratio", "Remove At Ratio", info.removeAtRatio as boolean | null, "boolean"),
                this.createTorrentDetailsField("creator", "Created By", info.creator as string | null),
                this.createTorrentDetailsField("comment", "Comment", info.comment as string | null, "text", { multiline: true }),
                this.createTorrentDetailsField("message", "Message", info.message as string | null, "text", { multiline: true }),
            ]),
            this.createTorrentDetailsSection("dates", "Dates", [
                this.createTorrentDetailsField("added-on", "Added On", this.toEpochSeconds(info.additionDate), "epoch"),
                this.createTorrentDetailsField("completed-on", "Completed On", this.toEpochSeconds(info.completionDate), "epoch"),
                this.createTorrentDetailsField("last-seen", "Last Seen Complete", this.toEpochSeconds(info.lastSeen), "epoch"),
                this.createTorrentDetailsField("last-transfer", "Time Since Transfer", this.toNumber(info.timeSinceTransfer), "number"),
                this.createTorrentDetailsField("last-download", "Time Since Download", this.toNumber(info.timeSinceDownload), "number"),
                this.createTorrentDetailsField("last-upload", "Time Since Upload", this.toNumber(info.timeSinceUpload), "number"),
            ]),
        ])
    }

    extraColumns = [
        Torrent.COL_DOWNLIMIT,
        Torrent.COL_UPLIMIT,
        DelugeTorrent.COL_AVAILABILITY,
        DelugeTorrent.COL_AUTO_MANAGED,
        DelugeTorrent.COL_FILES,
        DelugeTorrent.COL_REMAINING,
        DelugeTorrent.COL_SEED_PEER_RATIO,
        DelugeTorrent.COL_STORAGE_MODE,
        DelugeTorrent.COL_TRACKER,
    ]

    private baseActionHeader: TorrentActionList<DelugeTorrent> = [
        {
            label: 'Start',
            type: 'button',
            color: 'green',
            click: this.resume,
            icon: 'play',
            role: 'resume'
        },
        {
            label: 'Pause',
            type: 'button',
            color: 'red',
            click: this.pause,
            icon: 'pause',
            role: 'stop'
        },
        {
            label: "Labels",
            click: this.setLabel,
            type: "labels",
        },
    ]

    get actionHeader(): TorrentActionList<DelugeTorrent> {
        return this.features.labels
            ? this.baseActionHeader
            : this.baseActionHeader.filter((action) => action.type !== "labels")
    }
}
