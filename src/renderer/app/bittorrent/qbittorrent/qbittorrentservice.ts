import { Torrent } from "@renderer/app/bittorrent/abstracttorrent";
import {
  TorrentActionList,
  TorrentClient,
  TorrentUpdates,
  TorrentUploadOptions,
  TorrentSpeedLimitOptions,
  TorrentRatioLimitOptions,
  TorrentDetailsInfoSection,
} from "@renderer/app/bittorrent/torrentclient";
import { TorrentFile } from "@renderer/app/bittorrent/abstracttorrent";
import { QBittorrentTorrent } from "./torrentq";
import { addTorrentUrl, getSnapshot, getTorrentDetails, invokeAction, setTorrentFileSelection, uploadTorrent } from "@renderer/app/bittorrent/ipc";
import type { BittorrentTorrentDetailsData } from "@shared/ipc-contract";
import { applyFreeDiskSpace } from "@renderer/app/bittorrent/free-disk-space";

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

export class QBittorrentClient extends TorrentClient<QBittorrentTorrent> {
    public name = "qBittorrent"
    public id = "qbittorrent"

    torrents(fullupdate?: boolean): Promise<TorrentUpdates> {
      return getSnapshot(fullupdate).then((data: Record<string, any>) => this.processData(data));
    };

    processData(data: Record<string, any>) {
      const torrents: TorrentUpdates = {
        labels: [],
        all: [],
        changed: [],
        deleted: [],
      };

      applyFreeDiskSpace(torrents, data?.server_state?.free_space_on_disk);

      if (data?.server_state?.use_alt_speed_limits !== undefined) {
        torrents.alternativeSpeedLimitsEnabled = data.server_state.use_alt_speed_limits === true || data.server_state.use_alt_speed_limits === 1;
      }

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

      torrents.trackers = Array.isArray(data.trackers) ? data.trackers : [];
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

    extraColumns = [Torrent.COL_DOWNLIMIT, Torrent.COL_UPLIMIT];

    resume(torrents: Torrent[]): Promise<void> {
      return invokeAction("resume", torrents.map((torrent) => torrent.id));
    };

    resumeAll(): Promise<void> {
      return invokeAction("resumeAll");
    };

    pause(torrents: Torrent[]): Promise<void> {
      return invokeAction("pause", torrents.map((torrent) => torrent.id));
    };

    pauseAll(): Promise<void> {
      return invokeAction("pauseAll");
    };

    setAlternativeSpeedLimitsMode(enabled: boolean): Promise<void> {
      return invokeAction("setAlternativeSpeedLimitsMode", [], enabled);
    };

    recheck(torrents: Torrent[]): Promise<void> {
      return invokeAction("recheck", torrents.map((torrent) => torrent.id));
    };

    increasePrio(torrents: Torrent[]): Promise<void> {
      return invokeAction("increasePrio", torrents.map((torrent) => torrent.id));
    };

    decreasePrio(torrents: Torrent[]): Promise<void> {
      return invokeAction("decreasePrio", torrents.map((torrent) => torrent.id));
    };

    topPrio(torrents: Torrent[]): Promise<void> {
      return invokeAction("topPrio", torrents.map((torrent) => torrent.id));
    };

    bottomPrio(torrents: Torrent[]): Promise<void> {
      return invokeAction("bottomPrio", torrents.map((torrent) => torrent.id));
    };

    toggleSequentialDownload(torrents: Torrent[]): Promise<void> {
      return invokeAction("toggleSequentialDownload", torrents.map((torrent) => torrent.id));
    };

    delete(torrents: Torrent[]): Promise<void> {
      return invokeAction("delete", torrents.map((torrent) => torrent.id));
    };

    deleteAndRemove(torrents: Torrent[]): Promise<void> {
      return invokeAction("deleteAndRemove", torrents.map((torrent) => torrent.id));
    };

    setCategory(torrents: Torrent[], category: string, create?: boolean): Promise<void> {
      return invokeAction("setCategory", torrents.map((torrent) => torrent.id), category, create);
    };

    setLocation(torrents: QBittorrentTorrent[], location: string): Promise<void> {
      const resumeIds = torrents
        .filter((torrent) => !torrent.isStatusPaused() && !torrent.isStatusStopped())
        .map((torrent) => torrent.id);
      return invokeAction("setLocation", torrents.map((torrent) => torrent.id), location, resumeIds);
    }

    setSpeedLimits(torrents: QBittorrentTorrent[], options: TorrentSpeedLimitOptions): Promise<void> {
      return invokeAction("setSpeedLimits", torrents.map((torrent) => torrent.id), options);
    }

    setRatioLimit(torrents: QBittorrentTorrent[], options: TorrentRatioLimitOptions): Promise<void> {
      return invokeAction("setRatioLimit", torrents.map((torrent) => torrent.id), options);
    }

    deleteTorrents(torrents: QBittorrentTorrent[]): Promise<void> {
      return this.delete(torrents)
    }

    setTorrentFileSelection(torrent: QBittorrentTorrent, files: TorrentFile[]): Promise<void> {
      return setTorrentFileSelection(torrent.id, files);
    }

    protected getTorrentDetailsData(torrent: QBittorrentTorrent): Promise<BittorrentTorrentDetailsData> {
      return getTorrentDetails(torrent.id);
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
          this.createTorrentDetailsField("ratio-limit", "Ratio Limit", this.toNumber(info.ratioLimit) ?? torrent.ratioLimit, "ratio"),
          this.createTorrentDetailsField("download-speed", "Download Speed", this.toNumber(info.downloadSpeed) ?? torrent.downloadSpeed, "speed"),
          this.createTorrentDetailsField("upload-speed", "Upload Speed", this.toNumber(info.uploadSpeed) ?? torrent.uploadSpeed, "speed"),
          this.createTorrentDetailsField("download-limit", "Download Limit", this.toNumber(info.downloadLimit) ?? this.toNumber(torrent.downLimit), "speedLimit", { allowEmpty: true }),
          this.createTorrentDetailsField("upload-limit", "Upload Limit", this.toNumber(info.uploadLimit) ?? this.toNumber(torrent.upLimit), "speedLimit", { allowEmpty: true }),
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

    private baseActionHeader: TorrentActionList<QBittorrentTorrent> = [
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

    get actionHeader(): TorrentActionList<QBittorrentTorrent> {
      return this.features.labels
        ? this.baseActionHeader
        : this.baseActionHeader.filter((action) => action.type !== "labels")
    }
}
