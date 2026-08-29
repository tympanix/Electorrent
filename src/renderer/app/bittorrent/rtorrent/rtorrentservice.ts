import { Column } from "@renderer/app/services/column";
import { Torrent } from "@renderer/app/bittorrent/abstracttorrent";
import { TorrentActionList, TorrentClient, TorrentDetailsInfoSection, TorrentSpeedLimitOptions, TorrentUpdates, TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { RtorrentTorrent } from "./torrentr";
import { addTorrentUrl, getSnapshot, getTorrentDetails, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";
import type { BittorrentTorrentDetailsData } from "@shared/ipc-contract";

export class RtorrentClient extends TorrentClient<RtorrentTorrent> {
    public name = "rTorrent"
    public id = "rtorrent"
    defaultPath(): string {
      return "/RPC2";
    };

    async torrents(): Promise<TorrentUpdates> {
      const data: Record<string, any> = await getSnapshot()

      return {
        dirty: true,
        labels: data.labels,
        all: data.torrents.map((entry: Record<string, any>) => new RtorrentTorrent(entry)),
        changed: [],
        deleted: [],
        trackers: data.trackers,
      };
    };

    addTorrentUrl(magnet: string, options?: TorrentUploadOptions): Promise<void> {
      return addTorrentUrl(magnet, options)
    };

    uploadTorrent(buffer: Uint8Array, filename?: string, options?: TorrentUploadOptions, sourcePath?: string): Promise<void> {
      return uploadTorrent(buffer, filename || "upload.torrent", options, sourcePath)
    };

    start(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("start", torrents.map((torrent) => torrent.id))
    };

    stop(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("stop", torrents.map((torrent) => torrent.id))
    };

    label(torrents: RtorrentTorrent[], label: string): Promise<void> {
      return invokeAction("label", torrents.map((torrent) => torrent.id), label)
    };

    remove(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("remove", torrents.map((torrent) => torrent.id))
    };

    deleteAndErase(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("deleteAndErase", torrents.map((torrent) => torrent.id))
    };

    recheck(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("recheck", torrents.map((torrent) => torrent.id))
    };

    priorityHigh(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("priorityHigh", torrents.map((torrent) => torrent.id))
    };

    priorityNormal(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("priorityNormal", torrents.map((torrent) => torrent.id))
    };

    priorityLow(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("priorityLow", torrents.map((torrent) => torrent.id))
    };

    priorityOff(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("priorityOff", torrents.map((torrent) => torrent.id))
    };

    deleteTorrents(torrents: RtorrentTorrent[]): Promise<void> {
      return this.remove(torrents)
    }

    setSpeedLimits(torrents: RtorrentTorrent[], options: TorrentSpeedLimitOptions): Promise<void> {
      return invokeAction("setSpeedLimits", torrents.map((torrent) => torrent.id), options)
    }

    protected getTorrentDetailsData(torrent: RtorrentTorrent): Promise<BittorrentTorrentDetailsData> {
      return getTorrentDetails(torrent.id)
    }

    protected getTorrentDetailsInfoSections(torrent: RtorrentTorrent, details: BittorrentTorrentDetailsData): TorrentDetailsInfoSection[] {
      const info = this.getTorrentDetailsInfo(details)
      const toSpeedLimitBytes = (value: unknown) => {
        const limit = this.toNumber(value)
        return limit == null ? null : (limit < 0 ? -1 : limit * 1024)
      }

      return this.compactTorrentDetailsSections([
        this.createTorrentDetailsSection("overview", "Overview", [
          this.createTorrentDetailsField("name", "Name", torrent.name),
          this.createTorrentDetailsField("hash", "Hash", typeof torrent.hash === "string" ? torrent.hash.toLowerCase() : torrent.hash),
          this.createTorrentDetailsField("status", "Status", torrent.statusText()),
          this.createTorrentDetailsField("label", "Label", info.label as string | null, "text", { allowEmpty: true }),
          this.createTorrentDetailsField("save-path", "Save Path", info.savePath as string | null, "path"),
          this.createTorrentDetailsField("base-path", "Base Path", info.basePath as string | null, "path"),
          this.createTorrentDetailsField("torrent-file", "Torrent File", info.torrentFile as string | null, "path"),
          this.createTorrentDetailsField("session-file", "Session File", info.sessionFile as string | null, "path"),
          this.createTorrentDetailsField("total-size", "Total Size", this.toNumber(info.totalSize) ?? torrent.size, "bytes"),
          this.createTorrentDetailsField("priority", "Priority", info.priority as string | null),
          this.createTorrentDetailsField("group", "Choke Group", info.groupName as string | null, "text", { allowEmpty: true }),
          this.createTorrentDetailsField("throttle", "Throttle Group", info.throttleName as string | null, "text", { allowEmpty: true }),
        ]),
        this.createTorrentDetailsSection("transfer", "Transfer", [
          this.createTorrentDetailsField("downloaded", "Downloaded", this.toNumber(info.totalDownloaded) ?? torrent.downloaded, "bytes"),
          this.createTorrentDetailsField("uploaded", "Uploaded", this.toNumber(info.totalUploaded) ?? torrent.uploaded, "bytes"),
          this.createTorrentDetailsField("remaining", "Remaining", this.toNumber(info.leftBytes), "bytes"),
          this.createTorrentDetailsField("skipped", "Skipped", this.toNumber(info.skippedTotal), "bytes"),
          this.createTorrentDetailsField("skip-speed", "Skip Speed", this.toNumber(info.skippedSpeed), "speed"),
          this.createTorrentDetailsField("ratio", "Share Ratio", this.toNumber(info.shareRatio) ?? torrent.ratio, "ratio"),
          this.createTorrentDetailsField("download-speed", "Download Speed", this.toNumber(info.downloadSpeed) ?? torrent.downloadSpeed, "speed"),
          this.createTorrentDetailsField("upload-speed", "Upload Speed", this.toNumber(info.uploadSpeed) ?? torrent.uploadSpeed, "speed"),
          this.createTorrentDetailsField("download-limit", "Download Limit", toSpeedLimitBytes(info.downloadLimit), "speedLimit", { allowEmpty: true }),
          this.createTorrentDetailsField("upload-limit", "Upload Limit", toSpeedLimitBytes(info.uploadLimit), "speedLimit", { allowEmpty: true }),
          this.createTorrentDetailsField("eta", "ETA", this.toEpochSeconds(info.eta), "eta"),
        ]),
        this.createTorrentDetailsSection("swarm", "Swarm", [
          this.createTorrentDetailsField("seeds", "Connected Seeds", this.toNumber(info.seeds) ?? torrent.seedsConnected, "number"),
          this.createTorrentDetailsField("seeds-total", "Total Seeds", this.toNumber(info.seedsTotal) ?? torrent.seedsInSwarm, "number"),
          this.createTorrentDetailsField("peers", "Connected Peers", this.toNumber(info.peers) ?? torrent.peersConnected, "number"),
          this.createTorrentDetailsField("peers-total", "Total Peers", this.toNumber(info.peersTotal) ?? torrent.peersInSwarm, "number"),
          this.createTorrentDetailsField("peers-pending", "Pending Peers", this.toNumber(info.peersPending), "number"),
          this.createTorrentDetailsField("peers-min", "Minimum Peers", this.toNumber(info.peersMin), "number"),
          this.createTorrentDetailsField("peers-max", "Maximum Peers", this.toNumber(info.peersMax), "number"),
          this.createTorrentDetailsField("uploads-min", "Minimum Upload Slots", this.toNumber(info.uploadsMin), "number"),
          this.createTorrentDetailsField("uploads-max", "Maximum Upload Slots", this.toNumber(info.uploadsMax), "number"),
          this.createTorrentDetailsField("downloads-min", "Minimum Download Slots", this.toNumber(info.downloadsMin), "number"),
          this.createTorrentDetailsField("downloads-max", "Maximum Download Slots", this.toNumber(info.downloadsMax), "number"),
          this.createTorrentDetailsField("connection-type", "Connection Type", info.connectionType as string | null),
          this.createTorrentDetailsField("pex", "Peer Exchange", info.peerExchange as boolean | null, "boolean"),
          this.createTorrentDetailsField("pex-active", "Peer Exchange Active", info.peerExchangeActive as boolean | null, "boolean"),
        ]),
        this.createTorrentDetailsSection("content", "Content", [
          this.createTorrentDetailsField("piece-size", "Piece Size", this.toNumber(info.pieceSize), "bytes"),
          this.createTorrentDetailsField("pieces", "Pieces", this.toNumber(info.piecesTotal), "number"),
          this.createTorrentDetailsField("completed-chunks", "Completed Chunks", this.toNumber(info.chunksComplete), "number"),
          this.createTorrentDetailsField("wanted-pieces", "Wanted Pieces", this.toNumber(info.wantedPieces), "number"),
          this.createTorrentDetailsField("files", "Files", this.toNumber(info.filesTotal), "number"),
          this.createTorrentDetailsField("private", "Private Torrent", info.isPrivate as boolean | null, "boolean"),
          this.createTorrentDetailsField("multi-file", "Multi-file Torrent", info.isMultiFile as boolean | null, "boolean"),
          this.createTorrentDetailsField("free-disk-space", "Free Disk Space", this.toNumber(info.freeDiskSpace), "bytes"),
          this.createTorrentDetailsField("message", "Message", info.message as string | null, "text", { multiline: true }),
        ]),
        this.createTorrentDetailsSection("dates", "Dates", [
          this.createTorrentDetailsField("added-on", "Added On", this.toEpochSeconds(info.additionDate), "epoch"),
          this.createTorrentDetailsField("loaded-on", "Loaded On", this.toEpochSeconds(info.loadDate), "epoch"),
          this.createTorrentDetailsField("started-on", "Started On", this.toEpochSeconds(info.startDate), "epoch"),
          this.createTorrentDetailsField("completed-on", "Completed On", this.toEpochSeconds(info.completionDate), "epoch"),
          this.createTorrentDetailsField("state-changed-on", "State Changed On", this.toEpochSeconds(info.stateChangedDate), "epoch"),
          this.createTorrentDetailsField("created-on", "Created On", this.toEpochSeconds(info.creationDate), "epoch"),
        ]),
      ])
    }

    extraColumns = [
      Torrent.COL_DOWNLIMIT,
      Torrent.COL_UPLIMIT,
      new Column({
        name: "Tracker",
        attribute: "tracker",
        sort: Column.ALPHABETICAL,
      }),
      new Column({
        name: "Priority",
        attribute: "priority",
        template: "{{ torrent.priority }}",
        sort: Column.ALPHABETICAL,
      }),
      new Column({
        name: "Files",
        attribute: "fileCount",
        template: "{{ torrent.fileCount }}",
      }),
      new Column({
        name: "Pieces",
        attribute: "piecesCompleted",
        template: "{{ torrent.piecesCompleted }} of {{ torrent.pieceCount }}",
      }),
      new Column({
        name: "Private",
        attribute: "isPrivate",
        template: "{{ torrent.isPrivate ? 'Yes' : 'No' }}",
      }),
      new Column({
        name: "Throttle Group",
        attribute: "throttleName",
        template: "{{ torrent.throttleName }}",
        sort: Column.ALPHABETICAL,
      }),
      new Column({
        name: "Choke Group",
        attribute: "groupName",
        template: "{{ torrent.groupName }}",
        sort: Column.ALPHABETICAL,
      }),
    ];

    private baseActionHeader: TorrentActionList<RtorrentTorrent> = [
      {
        label: "Start",
        type: "button",
        color: "green",
        click: this.start,
        icon: "play",
        role: "resume",
      },
      {
        label: "Stop",
        type: "button",
        color: "red",
        click: this.stop,
        icon: "stop",
        role: "stop",
      },
      {
        label: "Labels",
        click: this.label,
        type: "labels",
      },
    ];

    get actionHeader(): TorrentActionList<RtorrentTorrent> {
      return this.features.labels
        ? this.baseActionHeader
        : this.baseActionHeader.filter((action) => action.type !== "labels")
    }
}
