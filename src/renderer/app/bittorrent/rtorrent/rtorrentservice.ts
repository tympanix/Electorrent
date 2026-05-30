import { Column } from "@renderer/app/services/column";
import { ContextActionList, TorrentActionList, TorrentClient, TorrentDetailsInfoSection, TorrentUpdates, TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { RtorrentTorrent } from "./torrentr";
import { addTorrentUrl, connect, getSnapshot, getTorrentDetails, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";
import type { BittorrentTorrentDetailsData } from "@shared/ipc-contract";

export class RtorrentClient extends TorrentClient<RtorrentTorrent> {
    public name = "rTorrent"
    public id = "rtorrent"
    public supportsTorrentDetails = true
    public uploadOptionsEnable = {
      saveLocation: true,
      startTorrent: true,
    }

    connect(server): Promise<void> {
        return connect(server)
    };

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

    uploadTorrent(buffer: Uint8Array, filename?: string, options?: TorrentUploadOptions): Promise<void> {
      return uploadTorrent(buffer, filename || "upload.torrent", options)
    };

    start(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("start", torrents.map((torrent) => torrent.hash))
    };

    stop(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("stop", torrents.map((torrent) => torrent.hash))
    };

    label(torrents: RtorrentTorrent[], label: string): Promise<void> {
      return invokeAction("label", torrents.map((torrent) => torrent.hash), label)
    };

    remove(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("remove", torrents.map((torrent) => torrent.hash))
    };

    deleteAndErase(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("deleteAndErase", torrents.map((torrent) => torrent.hash))
    };

    recheck(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("recheck", torrents.map((torrent) => torrent.hash))
    };

    priorityHigh(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("priorityHigh", torrents.map((torrent) => torrent.hash))
    };

    priorityNormal(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("priorityNormal", torrents.map((torrent) => torrent.hash))
    };

    priorityLow(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("priorityLow", torrents.map((torrent) => torrent.hash))
    };

    priorityOff(torrents: RtorrentTorrent[]): Promise<void> {
      return invokeAction("priorityOff", torrents.map((torrent) => torrent.hash))
    };

    deleteTorrents(torrents: RtorrentTorrent[]): Promise<void> {
      return this.remove(torrents)
    }

    protected getTorrentDetailsData(torrent: RtorrentTorrent): Promise<BittorrentTorrentDetailsData> {
      return getTorrentDetails(torrent.hash)
    }

    protected getTorrentDetailsInfoSections(torrent: RtorrentTorrent, details: BittorrentTorrentDetailsData): TorrentDetailsInfoSection[] {
      const info = this.getTorrentDetailsInfo(details)

      return this.compactTorrentDetailsSections([
        this.createTorrentDetailsSection("overview", "Overview", [
          this.createTorrentDetailsField("name", "Name", torrent.name),
          this.createTorrentDetailsField("hash", "Hash", typeof torrent.hash === "string" ? torrent.hash.toLowerCase() : torrent.hash),
          this.createTorrentDetailsField("status", "Status", torrent.statusText()),
          this.createTorrentDetailsField("label", "Label", info.label as string | null, "text", { allowEmpty: true }),
          this.createTorrentDetailsField("save-path", "Save Path", info.savePath as string | null, "path"),
          this.createTorrentDetailsField("total-size", "Total Size", this.toNumber(info.totalSize) ?? torrent.size, "bytes"),
        ]),
        this.createTorrentDetailsSection("transfer", "Transfer", [
          this.createTorrentDetailsField("downloaded", "Downloaded", this.toNumber(info.totalDownloaded) ?? torrent.downloaded, "bytes"),
          this.createTorrentDetailsField("uploaded", "Uploaded", this.toNumber(info.totalUploaded) ?? torrent.uploaded, "bytes"),
          this.createTorrentDetailsField("ratio", "Share Ratio", this.toNumber(info.shareRatio) ?? torrent.ratio, "ratio"),
          this.createTorrentDetailsField("download-speed", "Download Speed", this.toNumber(info.downloadSpeed) ?? torrent.downloadSpeed, "speed"),
          this.createTorrentDetailsField("upload-speed", "Upload Speed", this.toNumber(info.uploadSpeed) ?? torrent.uploadSpeed, "speed"),
          this.createTorrentDetailsField("eta", "ETA", this.toEpochSeconds(info.eta), "eta"),
        ]),
        this.createTorrentDetailsSection("swarm", "Swarm", [
          this.createTorrentDetailsField("seeds", "Connected Seeds", this.toNumber(info.seeds) ?? torrent.seedsConnected, "number"),
          this.createTorrentDetailsField("seeds-total", "Total Seeds", this.toNumber(info.seedsTotal) ?? torrent.seedsInSwarm, "number"),
          this.createTorrentDetailsField("peers", "Connected Peers", this.toNumber(info.peers) ?? torrent.peersConnected, "number"),
          this.createTorrentDetailsField("peers-total", "Total Peers", this.toNumber(info.peersTotal) ?? torrent.peersInSwarm, "number"),
        ]),
        this.createTorrentDetailsSection("content", "Content", [
          this.createTorrentDetailsField("piece-size", "Piece Size", this.toNumber(info.pieceSize), "bytes"),
          this.createTorrentDetailsField("completed-chunks", "Completed Chunks", this.toNumber(info.chunksComplete), "number"),
          this.createTorrentDetailsField("message", "Message", info.message as string | null, "text", { multiline: true }),
        ]),
        this.createTorrentDetailsSection("dates", "Dates", [
          this.createTorrentDetailsField("added-on", "Added On", this.toEpochSeconds(info.additionDate), "epoch"),
          this.createTorrentDetailsField("created-on", "Created On", this.toEpochSeconds(info.creationDate), "epoch"),
        ]),
      ])
    }

    enableTrackerFilter = true;

    extraColumns = [
      new Column({
        name: "Tracker",
        attribute: "tracker",
        template: "{{ torrent.tracker }}",
        sort: Column.ALPHABETICAL,
      }),
    ];

    actionHeader: TorrentActionList<RtorrentTorrent> = [
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

    contextMenu: ContextActionList<RtorrentTorrent> = [
      {
        id: "torrent-details",
        role: "torrent-details",
        label: "Details",
        click: () => Promise.resolve(),
        icon: "info circle",
      },
      {
        label: "Recheck",
        click: this.recheck,
        icon: "checkmark",
      },
      {
        label: "Priority",
        menu: [
          {
            label: "High",
            click: this.priorityHigh,
          },
          {
            label: "Normal",
            click: this.priorityNormal,
          },
          {
            label: "Low",
            click: this.priorityLow,
          },
          {
            label: "Don't Download",
            click: this.priorityOff,
          },
        ],
      },
      {
        label: "Remove",
        click: this.remove,
        icon: "remove",
      },
      {
        label: "Remove and Delete",
        click: this.deleteAndErase,
        icon: "trash",
        role: "delete",
      },
    ];
}
