import { ContextActionList, TorrentActionList, TorrentClient, TorrentDetailsInfoSection, TorrentUpdates, TorrentUploadOptions, TorrentUploadOptionsEnable } from "@renderer/app/bittorrent/torrentclient";
import { DelugeTorrent } from "./torrentd";
import { addTorrentUrl, connect, getSnapshot, getTorrentDetails, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";
import type { BittorrentTorrentDetailsData } from "@shared/ipc-contract";

export class DelugeClient extends TorrentClient<DelugeTorrent> {
    public name = 'Deluge'
    public id = 'deluge'
    public supportsTorrentDetails = true
    public supportsLabels = false
    public uploadOptionsEnable: TorrentUploadOptionsEnable = {
        saveLocation: true,
        category: true,
        startTorrent: true,
        peerLimit: true,
        firstAndLastPiecePrio: true,
        downloadSpeedLimit: true,
        uploadSpeedLimit: true,
    }

    connect(server): Promise<void> {
        return connect(server)
    }

    async torrents(): Promise<TorrentUpdates> {
        const data: Record<string, any> = await getSnapshot()
        const supportsLabels = data.supportsLabels === true
        if (this.supportsLabels !== supportsLabels) {
            this.supportsLabels = supportsLabels
            this.updateLabelActions()
        }
        this.uploadOptionsEnable.category = this.supportsLabels

        return {
            labels: Array.isArray(data.labels) ? data.labels : [],
            supportsLabels: this.supportsLabels,
            all: Object.keys(data.torrents || {}).map((hash) => new DelugeTorrent(hash, data.torrents[hash])),
            changed: [],
            deleted: [],
            dirty: true,
        }
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
        return invokeAction("resume", torrents.map((torrent) => torrent.hash))
    }

    pause(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("pause", torrents.map((torrent) => torrent.hash))
    }

    verify(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("verify", torrents.map((torrent) => torrent.hash))
    }

    remove(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("remove", torrents.map((torrent) => torrent.hash))
    }

    removeAndDelete(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("removeAndDelete", torrents.map((torrent) => torrent.hash))
    }

    queueUp(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueUp", torrents.map((torrent) => torrent.hash))
    }

    queueDown(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueDown", torrents.map((torrent) => torrent.hash))
    }

    queueTop(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueTop", torrents.map((torrent) => torrent.hash))
    }

    queueBottom(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueBottom", torrents.map((torrent) => torrent.hash))
    }

    setLabel(torrents: DelugeTorrent[], label: string, create?: boolean): Promise<void> {
        return invokeAction("setLabel", torrents.map((torrent) => torrent.hash), label, create)
    }

    private updateLabelActions() {
        const labelAction = {
            label: "Labels",
            click: this.setLabel,
            type: "labels" as const,
        }

        this.actionHeader = [
            ...this.baseActionHeader,
            ...(this.supportsLabels ? [labelAction] : []),
        ]
    }

    deleteTorrents(torrents: DelugeTorrent[]): Promise<void> {
        return this.remove(torrents)
    }

    protected getTorrentDetailsData(torrent: DelugeTorrent): Promise<BittorrentTorrentDetailsData> {
        return getTorrentDetails(torrent.hash)
    }

    protected getTorrentDetailsInfoSections(torrent: DelugeTorrent, details: BittorrentTorrentDetailsData): TorrentDetailsInfoSection[] {
        const info = this.getTorrentDetailsInfo(details)

        return this.compactTorrentDetailsSections([
            this.createTorrentDetailsSection("overview", "Overview", [
                this.createTorrentDetailsField("name", "Name", torrent.name),
                this.createTorrentDetailsField("hash", "Hash", torrent.hash),
                this.createTorrentDetailsField("status", "Status", torrent.statusText()),
                this.createTorrentDetailsField("save-path", "Save Path", info.savePath as string | null, "path"),
                this.createTorrentDetailsField("total-size", "Total Size", this.toNumber(info.totalSize) ?? torrent.size, "bytes"),
            ]),
            this.createTorrentDetailsSection("transfer", "Transfer", [
                this.createTorrentDetailsField("downloaded", "Downloaded", this.toNumber(info.totalDownloaded) ?? torrent.downloaded, "bytes"),
                this.createTorrentDetailsField("uploaded", "Uploaded", this.toNumber(info.totalUploaded) ?? torrent.uploaded, "bytes"),
                this.createTorrentDetailsField("ratio", "Share Ratio", this.toNumber(info.shareRatio) ?? torrent.ratio, "ratio"),
                this.createTorrentDetailsField("download-speed", "Download Speed", this.toNumber(info.downloadSpeed) ?? torrent.downloadSpeed, "speed"),
                this.createTorrentDetailsField("upload-speed", "Upload Speed", this.toNumber(info.uploadSpeed) ?? torrent.uploadSpeed, "speed"),
                this.createTorrentDetailsField("download-limit", "Download Limit (KB/s)", this.toNumber(info.downloadLimit), "number"),
                this.createTorrentDetailsField("upload-limit", "Upload Limit (KB/s)", this.toNumber(info.uploadLimit), "number"),
                this.createTorrentDetailsField("eta", "ETA", this.toEpochSeconds(info.eta), "eta"),
                this.createTorrentDetailsField("active-time", "Active Time", this.toNumber(info.timeElapsed), "number"),
                this.createTorrentDetailsField("seeding-time", "Seeding Time", this.toNumber(info.seedingTime), "number"),
            ]),
            this.createTorrentDetailsSection("swarm", "Swarm", [
                this.createTorrentDetailsField("seeds", "Connected Seeds", this.toNumber(info.seeds), "number"),
                this.createTorrentDetailsField("seeds-total", "Total Seeds", this.toNumber(info.seedsTotal), "number"),
                this.createTorrentDetailsField("peers", "Connected Peers", this.toNumber(info.peers), "number"),
                this.createTorrentDetailsField("peers-total", "Total Peers", this.toNumber(info.peersTotal), "number"),
                this.createTorrentDetailsField("connections-limit", "Peer Limit", this.toNumber(info.connectionsLimit), "number"),
                this.createTorrentDetailsField("copies", "Distributed Copies", this.toNumber(info.distributedCopies), "number"),
                this.createTorrentDetailsField("tracker", "Tracker", info.trackerHost as string | null),
            ]),
            this.createTorrentDetailsSection("content", "Content", [
                this.createTorrentDetailsField("piece-size", "Piece Size", this.toNumber(info.pieceSize), "bytes"),
                this.createTorrentDetailsField("pieces", "Pieces", this.toNumber(info.piecesTotal), "number"),
                this.createTorrentDetailsField("owner", "Owner", info.owner as string | null),
                this.createTorrentDetailsField("super-seeding", "Super Seeding", info.superSeeding as boolean | null, "boolean"),
                this.createTorrentDetailsField("seed-rank", "Seed Rank", this.toNumber(info.seedRank), "number"),
                this.createTorrentDetailsField("message", "Message", info.message as string | null, "text", { multiline: true }),
            ]),
            this.createTorrentDetailsSection("dates", "Dates", [
                this.createTorrentDetailsField("added-on", "Added On", this.toEpochSeconds(info.additionDate), "epoch"),
                this.createTorrentDetailsField("completed-on", "Completed On", this.toEpochSeconds(info.completionDate), "epoch"),
                this.createTorrentDetailsField("last-seen", "Last Seen Complete", this.toEpochSeconds(info.lastSeen), "epoch"),
                this.createTorrentDetailsField("last-transfer", "Time Since Transfer", this.toNumber(info.timeSinceTransfer), "number"),
            ]),
        ])
    }

    enableTrackerFilter = false

    extraColumns = []

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
    ]

    actionHeader: TorrentActionList<DelugeTorrent> = this.baseActionHeader

    contextMenu: ContextActionList<DelugeTorrent> = [
        {
            id: "torrent-details",
            role: "torrent-details",
            label: "Details",
            click: () => Promise.resolve(),
            icon: "info circle"
        },
        {
            label: 'Verify',
            click: this.verify,
            icon: 'checkmark'
        },
        {
            label: 'Move Queue Up',
            click: this.queueUp,
            icon: 'arrow up'
        },
        {
            label: 'Move Queue Down',
            click: this.queueDown,
            icon: 'arrow down'
        },
        {
            label: 'Queue Top',
            click: this.queueTop,
            icon: 'chevron circle up'
        },
        {
            label: 'Queue Bottom',
            click: this.queueBottom,
            icon: 'chevron circle down'
        },
        {
            label: 'Remove',
            click: this.remove,
            icon: 'remove'
        },
        {
            label: 'Remove and delete',
            click: this.removeAndDelete,
            icon: 'trash',
            role: 'delete'
        },
    ];

}
