import { Torrent } from "@renderer/app/bittorrent/abstracttorrent";
import {
  TorrentActionList,
  TorrentClient,
  TorrentUpdates,
  ContextActionList,
  TorrentUploadOptions,
  TorrentUploadOptionsEnable,
  TorrentDetailsInfoSection,
} from "@renderer/app/bittorrent/torrentclient";
import { TorrentFile } from "@renderer/app/bittorrent/abstracttorrent";
import { QBittorrentTorrent } from "./torrentq";
import { addTorrentUrl, connect, getSnapshot, getTorrentDetails, getTorrentFiles, invokeAction, setTorrentFileSelection, uploadTorrent } from "@renderer/app/bittorrent/ipc";
import type { BittorrentTorrentDetailsData } from "@shared/ipc-contract";

export interface QBittorrentUploadOptions {
  savepath?: string
  cookie?: string
  category?: string
  tags?: string
  skip_checking?: boolean
  paused?: boolean
  stopped?: boolean
  root_folder?: boolean
  rename?: string
  upLimit?: number
  dlLimit?: number
  autoTMM?: boolean
  sequentialDownload?: boolean
  firstLastPiecePrio?: boolean
}

const QBITTORRENT_PRIORITY_SKIP = 0;

export class QBittorrentClient extends TorrentClient<QBittorrentTorrent> {
    public name = "qBittorrent"
    public id = "qbittorrent"

    public supportsFileSelection = true
    public supportsSetLocation = true
    public supportsTorrentDetails = true

    connect(server): Promise<void> {
      return connect(server)
    };

    torrents(fullupdate?: boolean): Promise<TorrentUpdates> {
      return getSnapshot(fullupdate).then((data: Record<string, any>) => this.processData(data));
    };

    processData(data: Record<string, any>) {
      const torrents = {
        labels: [],
        all: [],
        changed: [],
        deleted: [],
        freeDiskSpace: data?.server_state?.free_space_on_disk ?? null,
      };

      if (Array.isArray(data.categories) || Array.isArray(data.labels)) {
        torrents.labels = data.categories || data.labels;
      } else if (typeof data.categories === "object") {
        torrents.labels = Object.values(data.categories).map((c: any) => c.name);
      }

      if (data.full_update) {
        torrents.all = this.buildAll(data.torrents);
      } else {
        torrents.changed = this.buildAll(data.torrents);
      }

      torrents.deleted = data.torrents_removed || [];
      return torrents;
    }

    buildAll(torrents: Record<string, any>) {
      if (!torrents) return [];

      return Object.keys(torrents).map((hash) => new QBittorrentTorrent(hash, torrents[hash]));
    }

    defaultPath() {
      return "/";
    };

    uploadTorrent(buffer: Uint8Array, filename: string, options?: TorrentUploadOptions, sourcePath?: string): Promise<void> {
      return uploadTorrent(buffer, filename, options, sourcePath);
    };

    addTorrentUrl(magnet: string, options?: TorrentUploadOptions): Promise<void> {
      return addTorrentUrl(magnet, options);
    };

    public uploadOptionsEnable: TorrentUploadOptionsEnable = {
      saveLocation: true,
      renameTorrent: true,
      category: true,
      startTorrent: true,
      skipCheck: true,
      sequentialDownload: true,
      firstAndLastPiecePrio: true,
      downloadSpeedLimit: true,
      uploadSpeedLimit: true,
    }

    enableTrackerFilter = false;

    extraColumns = [];

    resume(torrents: Torrent[]): Promise<void> {
      return invokeAction("resume", torrents.map((torrent) => torrent.hash));
    };

    resumeAll(): Promise<void> {
      return invokeAction("resumeAll");
    };

    pause(torrents: Torrent[]): Promise<void> {
      return invokeAction("pause", torrents.map((torrent) => torrent.hash));
    };

    pauseAll(): Promise<void> {
      return invokeAction("pauseAll");
    };

    recheck(torrents: Torrent[]): Promise<void> {
      return invokeAction("recheck", torrents.map((torrent) => torrent.hash));
    };

    increasePrio(torrents: Torrent[]): Promise<void> {
      return invokeAction("increasePrio", torrents.map((torrent) => torrent.hash));
    };

    decreasePrio(torrents: Torrent[]): Promise<void> {
      return invokeAction("decreasePrio", torrents.map((torrent) => torrent.hash));
    };

    topPrio(torrents: Torrent[]): Promise<void> {
      return invokeAction("topPrio", torrents.map((torrent) => torrent.hash));
    };

    bottomPrio(torrents: Torrent[]): Promise<void> {
      return invokeAction("bottomPrio", torrents.map((torrent) => torrent.hash));
    };

    toggleSequentialDownload(torrents: Torrent[]): Promise<void> {
      return invokeAction("toggleSequentialDownload", torrents.map((torrent) => torrent.hash));
    };

    delete(torrents: Torrent[]): Promise<void> {
      return invokeAction("delete", torrents.map((torrent) => torrent.hash));
    };

    deleteAndRemove(torrents: Torrent[]): Promise<void> {
      return invokeAction("deleteAndRemove", torrents.map((torrent) => torrent.hash));
    };

    setCategory(torrents: Torrent[], category: string, create?: boolean): Promise<void> {
      return invokeAction("setCategory", torrents.map((torrent) => torrent.hash), category, create);
    };

    setLocation(torrents: QBittorrentTorrent[], location: string): Promise<void> {
      const resumeHashes = torrents
        .filter((torrent) => !torrent.isStatusPaused() && !torrent.isStatusStopped())
        .map((torrent) => torrent.hash);
      return invokeAction("setLocation", torrents.map((torrent) => torrent.hash), location, resumeHashes);
    }

    deleteTorrents(torrents: QBittorrentTorrent[]): Promise<void> {
      return this.delete(torrents)
    }

    async getTorrentFiles(torrent: QBittorrentTorrent): Promise<TorrentFile[]> {
      const body = await getTorrentFiles(torrent.hash);
      if (!Array.isArray(body)) {
        throw new Error("Invalid response");
      }

      return body.map((file: any, idx: number) => ({
        index: file.index != null ? file.index : idx,
        path: file.name || "",
        name: (file.name || "").split(/[/\\]/).pop() || "",
        size: typeof file.size === "number" ? file.size : (parseInt(String(file.size), 10) || 0),
        wanted: (file.priority != null ? file.priority : 1) !== QBITTORRENT_PRIORITY_SKIP,
        priority: file.priority,
      }));
    }

    setTorrentFileSelection(torrent: QBittorrentTorrent, files: TorrentFile[]): Promise<void> {
      return setTorrentFileSelection(torrent.hash, files);
    }

    protected getTorrentDetailsData(torrent: QBittorrentTorrent): Promise<BittorrentTorrentDetailsData> {
      return getTorrentDetails(torrent.hash);
    }

    protected getTorrentDetailsInfoSections(torrent: QBittorrentTorrent, details: BittorrentTorrentDetailsData): TorrentDetailsInfoSection[] {
      const info = this.getTorrentDetailsInfo(details);
      const piecesHave = this.toNumber(info.piecesHave);
      const piecesTotal = this.toNumber(info.piecesTotal);

      return this.compactTorrentDetailsSections([
        this.createTorrentDetailsSection("overview", "Overview", [
          this.createTorrentDetailsField("name", "Name", torrent.name),
          this.createTorrentDetailsField("hash", "Hash", torrent.hash),
          this.createTorrentDetailsField("status", "Status", torrent.statusText()),
          this.createTorrentDetailsField("label", "Label", torrent.label),
          this.createTorrentDetailsField("save-path", "Save Path", info.savePath as string | null, "path"),
          this.createTorrentDetailsField("total-size", "Total Size", this.toNumber(info.totalSize) ?? torrent.size, "bytes"),
        ]),
        this.createTorrentDetailsSection("transfer", "Transfer", [
          this.createTorrentDetailsField("downloaded", "Downloaded", this.toNumber(info.totalDownloaded) ?? torrent.downloaded, "bytes"),
          this.createTorrentDetailsField("uploaded", "Uploaded", this.toNumber(info.totalUploaded) ?? torrent.uploaded, "bytes"),
          this.createTorrentDetailsField("ratio", "Share Ratio", this.toNumber(info.shareRatio) ?? torrent.ratio, "ratio"),
          this.createTorrentDetailsField("download-speed", "Download Speed", this.toNumber(info.downloadSpeed) ?? torrent.downloadSpeed, "speed"),
          this.createTorrentDetailsField("upload-speed", "Upload Speed", this.toNumber(info.uploadSpeed) ?? torrent.uploadSpeed, "speed"),
          this.createTorrentDetailsField("download-limit", "Download Limit (KB/s)", this.toNumber(info.downloadLimit) ?? this.toNumber(torrent.downLimit), "number"),
          this.createTorrentDetailsField("upload-limit", "Upload Limit (KB/s)", this.toNumber(info.uploadLimit) ?? this.toNumber(torrent.upLimit), "number"),
          this.createTorrentDetailsField("download-speed-avg", "Average Download Speed", this.toNumber(info.averageDownloadSpeed), "speed"),
          this.createTorrentDetailsField("upload-speed-avg", "Average Upload Speed", this.toNumber(info.averageUploadSpeed), "speed"),
          this.createTorrentDetailsField("eta", "ETA", this.toEpochSeconds(info.eta), "eta"),
          this.createTorrentDetailsField("reannounce", "Reannounce In", this.toEpochSeconds(info.reannounce), "eta"),
        ]),
        this.createTorrentDetailsSection("content", "Content", [
          this.createTorrentDetailsField("piece-size", "Piece Size", this.toNumber(info.pieceSize), "bytes"),
          this.createTorrentDetailsField("pieces", "Pieces", piecesHave != null && piecesTotal != null ? `${piecesHave} / ${piecesTotal}` : null),
          this.createTorrentDetailsField("sequential-download", "Sequential Download", (info.sequentialDownload as boolean | null) ?? torrent.sequentialDownload, "boolean"),
          this.createTorrentDetailsField("private", "Private Torrent", info.isPrivate as boolean | null, "boolean"),
          this.createTorrentDetailsField("created-by", "Created By", info.createdBy as string | null),
          this.createTorrentDetailsField("comment", "Comment", info.comment as string | null, "text", { multiline: true }),
        ]),
        this.createTorrentDetailsSection("swarm", "Swarm", [
          this.createTorrentDetailsField("connections", "Connected Peers", this.toNumber(info.connections), "number"),
          this.createTorrentDetailsField("connections-limit", "Peer Limit", this.toNumber(info.connectionsLimit) ?? this.toNumber(torrent.connectionsLimit), "number"),
          this.createTorrentDetailsField("seeds", "Connected Seeds", this.toNumber(info.seeds) ?? torrent.seedsConnected, "number"),
          this.createTorrentDetailsField("seeds-total", "Total Seeds", this.toNumber(info.seedsTotal) ?? torrent.seedsInSwarm, "number"),
          this.createTorrentDetailsField("peers", "Connected Peers", this.toNumber(info.peers) ?? torrent.peersConnected, "number"),
          this.createTorrentDetailsField("peers-total", "Total Peers", this.toNumber(info.peersTotal) ?? torrent.peersInSwarm, "number"),
        ]),
        this.createTorrentDetailsSection("dates", "Dates", [
          this.createTorrentDetailsField("added-on", "Added On", this.toEpochSeconds(info.additionDate), "epoch"),
          this.createTorrentDetailsField("completed-on", "Completed On", this.toEpochSeconds(info.completionDate), "epoch"),
          this.createTorrentDetailsField("created-on", "Created On", this.toEpochSeconds(info.creationDate), "epoch"),
          this.createTorrentDetailsField("last-seen", "Last Seen Complete", this.toEpochSeconds(info.lastSeen), "epoch"),
        ]),
      ]);
    }

    actionHeader: TorrentActionList<QBittorrentTorrent> = [
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
          {
            label: "Pause All",
            click: this.pauseAll,
          },
          {
            label: "Resume All",
            click: this.resumeAll,
          },
        ],
      },
      {
        label: "Labels",
        click: this.setCategory,
        type: "labels",
      },
    ];

    contextMenu: ContextActionList<QBittorrentTorrent> = [
      {
        id: "torrent-details",
        role: "torrent-details",
        label: "Details",
        click: () => Promise.resolve(),
        icon: "info circle",
      },
      {
        id: 'torrent-files',
        label: "Files",
        click: () => Promise.resolve(),
        icon: "file",
      },
      {
        label: "Recheck",
        click: this.recheck,
        icon: "checkmark",
      },
      {
        label: "Move Up Queue",
        click: this.increasePrio,
        icon: "arrow up",
      },
      {
        label: "Move Queue Down",
        click: this.decreasePrio,
        icon: "arrow down",
      },
      {
        label: "Queue Top",
        click: this.topPrio,
        icon: "chevron circle up",
      },
      {
        label: "Queue Bottom",
        click: this.bottomPrio,
        icon: "chevron circle down",
      },
      {
        label: "Sequential Download",
        click: this.toggleSequentialDownload,
        check: function (torrent: QBittorrentTorrent) {
          return torrent.sequentialDownload;
        },
      },
      {
        id: "torrent-set-location",
        label: "Set Location",
        click: () => Promise.resolve(),
        icon: "folder open",
      },
      {
        label: "Remove",
        click: this.delete,
        icon: "remove",
      },
      {
        label: "Remove And Delete",
        click: this.deleteAndRemove,
        icon: "trash",
        role: "delete",
      },
    ];
}
