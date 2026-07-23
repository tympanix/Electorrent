import { Torrent } from "@renderer/app/bittorrent/abstracttorrent"
import { addTorrentUrl, getSnapshot, getTorrentDetails, invokeAction, setTorrentFileSelection, uploadTorrent } from "@renderer/app/bittorrent/ipc"
import type { TorrentFile } from "@renderer/app/bittorrent/abstracttorrent"
import type {
    TorrentActionList,
    TorrentDetailsInfoSection,
    TorrentRatioLimitOptions,
    TorrentSpeedLimitOptions,
    TorrentUpdates,
    TorrentUploadOptions,
} from "@renderer/app/bittorrent/torrentclient"
import type { BittorrentTorrentDetailsData } from "@shared/ipc-contract"
import { TorrentClient } from "@renderer/app/bittorrent/torrentclient"
import { CLIENT_METADATA } from "@shared/client-metadata"
import { Aria2Torrent } from "./torrentaria2"

export class Aria2Client extends TorrentClient<Aria2Torrent> {
    public name = "aria2"
    public id = "aria2"
    public extraColumns = [Torrent.COL_QUEUE, Torrent.COL_DOWNLIMIT, Torrent.COL_UPLIMIT]

    defaultPort() { return CLIENT_METADATA.aria2.defaultPort }
    defaultPath() { return "/jsonrpc" }

    async torrents(): Promise<TorrentUpdates> {
        const snapshot = await getSnapshot()
        const all = Array.isArray(snapshot?.torrents) ? snapshot.torrents.map((torrent) => new Aria2Torrent(torrent)) : []
        return {
            labels: [],
            all,
            changed: [],
            deleted: [],
            dirty: true,
            trackers: [...new Set(all.flatMap((torrent) => torrent.trackers).flatMap((tracker) => {
                try {
                    const hostname = new URL(tracker).hostname
                    return hostname ? [hostname] : []
                } catch {
                    return []
                }
            }))],
        }
    }

    addTorrentUrl(uri: string, options?: TorrentUploadOptions): Promise<void> {
        return addTorrentUrl(uri, options)
    }

    uploadTorrent(buffer: Uint8Array, filename: string, options?: TorrentUploadOptions, sourcePath?: string): Promise<void> {
        return uploadTorrent(buffer, filename, options, sourcePath)
    }

    resume(torrents: Aria2Torrent[]): Promise<void> {
        return invokeAction("resume", torrents.map((torrent) => torrent.hash))
    }

    pause(torrents: Aria2Torrent[]): Promise<void> {
        return invokeAction("pause", torrents.map((torrent) => torrent.hash))
    }

    resumeAll(): Promise<void> {
        return invokeAction("resumeAll")
    }

    pauseAll(): Promise<void> {
        return invokeAction("pauseAll")
    }

    remove(torrents: Aria2Torrent[]): Promise<void> {
        return invokeAction("remove", torrents.map((torrent) => torrent.hash))
    }

    setSpeedLimits(torrents: Aria2Torrent[], options: TorrentSpeedLimitOptions): Promise<void> {
        return invokeAction("setSpeedLimits", torrents.map((torrent) => torrent.hash), options)
    }

    setRatioLimit(torrents: Aria2Torrent[], options: TorrentRatioLimitOptions): Promise<void> {
        return invokeAction("setRatioLimit", torrents.map((torrent) => torrent.hash), options)
    }

    setTorrentFileSelection(torrent: Aria2Torrent, files: TorrentFile[]): Promise<void> {
        return setTorrentFileSelection(torrent.hash, files)
    }

    protected getTorrentDetailsData(torrent: Aria2Torrent): Promise<BittorrentTorrentDetailsData> {
        return getTorrentDetails(torrent.hash)
    }

    protected getTorrentDetailsInfoSections(torrent: Aria2Torrent, details: BittorrentTorrentDetailsData): TorrentDetailsInfoSection[] {
        const info = this.getTorrentDetailsInfo(details)
        return this.compactTorrentDetailsSections([
            this.createTorrentDetailsSection("overview", "Overview", [
                this.createTorrentDetailsField("name", "Name", torrent.name),
                this.createTorrentDetailsField("hash", "Hash", typeof info.hash === "string" ? info.hash.toLowerCase() : torrent.hash.toLowerCase()),
                this.createTorrentDetailsField("status", "Status", torrent.statusText()),
                this.createTorrentDetailsField("save-path", "Save Path", info.savePath as string | null, "path"),
                this.createTorrentDetailsField("total-size", "Total Size", this.toNumber(info.totalSize) ?? torrent.size, "bytes"),
            ]),
            this.createTorrentDetailsSection("transfer", "Transfer", [
                this.createTorrentDetailsField("downloaded", "Downloaded", this.toNumber(info.totalDownloaded) ?? torrent.downloaded, "bytes"),
                this.createTorrentDetailsField("uploaded", "Uploaded", this.toNumber(info.totalUploaded) ?? torrent.uploaded, "bytes"),
                this.createTorrentDetailsField("ratio", "Share Ratio", this.toNumber(info.shareRatio) ?? torrent.ratio, "ratio"),
                this.createTorrentDetailsField("ratio-limit", "Ratio Limit", this.toNumber(info.ratioLimit) ?? torrent.ratioLimit, "ratio"),
                this.createTorrentDetailsField("download-speed", "Download Speed", this.toNumber(info.downloadSpeed) ?? torrent.downloadSpeed, "speed"),
                this.createTorrentDetailsField("upload-speed", "Upload Speed", this.toNumber(info.uploadSpeed) ?? torrent.uploadSpeed, "speed"),
                this.createTorrentDetailsField("download-limit", "Download Limit", this.toNumber(info.downloadLimit), "speedLimit", { allowEmpty: true }),
                this.createTorrentDetailsField("upload-limit", "Upload Limit", this.toNumber(info.uploadLimit), "speedLimit", { allowEmpty: true }),
            ]),
            this.createTorrentDetailsSection("content", "Content", [
                this.createTorrentDetailsField("piece-size", "Piece Size", this.toNumber(info.pieceSize), "bytes"),
                this.createTorrentDetailsField("pieces", "Pieces", this.toNumber(info.piecesTotal), "number"),
                this.createTorrentDetailsField("verified", "Verified", this.toNumber(info.verifiedLength), "bytes"),
                this.createTorrentDetailsField("verification-pending", "Verification Pending", info.verifyIntegrityPending as boolean | null, "boolean"),
            ]),
            this.createTorrentDetailsSection("swarm", "Swarm", [
                this.createTorrentDetailsField("connections", "Connected Peers", this.toNumber(info.connections), "number"),
                this.createTorrentDetailsField("connections-limit", "Peer Limit", this.toNumber(info.connectionsLimit), "number"),
                this.createTorrentDetailsField("error-code", "Error Code", info.errorCode as string | null),
                this.createTorrentDetailsField("error", "Error", info.errorString as string | null, "text", { multiline: true }),
            ]),
        ])
    }

    deleteTorrents(torrents: Aria2Torrent[]): Promise<void> {
        return this.remove(torrents)
    }

    public actionHeader: TorrentActionList<Aria2Torrent> = [
        {
            label: "Start",
            type: "button",
            color: "green",
            click: this.resume,
            icon: "play",
            role: "resume",
        },
        {
            label: "Pause",
            type: "button",
            color: "red",
            click: this.pause,
            icon: "pause",
            role: "stop",
        },
        {
            label: "More",
            type: "dropdown",
            color: "blue",
            icon: "plus",
            actions: [
                { label: "Pause All", click: this.pauseAll },
                { label: "Resume All", click: this.resumeAll },
            ],
        },
    ]
}
