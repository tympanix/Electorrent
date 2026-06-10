import { ContextActionList, TorrentActionList, TorrentClient, TorrentDetailsInfoSection, TorrentUpdates, TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { TransmissionTorrent } from "./torrentt";
import _ from "underscore"
import { addTorrentUrl, getSnapshot, getTorrentDetails, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";
import type { BittorrentTorrentDetailsData } from "@shared/ipc-contract";

const URL_REGEX = /^[a-z]+:\/\/(?:[a-z0-9-]+\.)*((?:[a-z0-9-]+\.)[a-z]+)/;

export class TransmissionClient extends TorrentClient<TransmissionTorrent> {
    public name = "Transmission";
    public id = "transmission"
    defaultPath(): string {
      return "/transmission/rpc";
    };

    async torrents(): Promise<TorrentUpdates> {
      return this.processData(await getSnapshot())
    };

    processData(data) {
      const torrents = {
        dirty: true,
        labels: [],
        all: [],
        changed: [],
        deleted: [],
        trackers: [],
      };
      torrents.all = data.arguments.torrents.map(this.build);
      torrents.labels = Array.from(new Set(
        torrents.all.flatMap((torrent) => torrent.labels)
      ));
      torrents.trackers = this.getTrackers(torrents.all);
      return torrents;
    }

    build(data: Record<string, any>) {
      return new TransmissionTorrent(data);
    }

    getTrackers(torrents) {
      const trackers = new Set<string>();
      torrents.forEach((torrent) => {
        torrent.trackers.forEach((tracker) => trackers.add(tracker));
      });
      const trackerArray = Array.from(trackers).map(
        (tracker) => this.parseUrl(tracker)
      );
      return _.compact(trackerArray);
    }

    parseUrl(url: string) {
      const match = url.match(URL_REGEX);
      return match && match[1];
    }

    addTorrentUrl(magnet: string, uploadOptions: TorrentUploadOptions): Promise<void> {
      return addTorrentUrl(magnet, uploadOptions)
    };

    uploadTorrent(buffer: Uint8Array, filename?: string, uploadOptions?: TorrentUploadOptions, sourcePath?: string): Promise<void> {
      return uploadTorrent(buffer, filename || "upload.torrent", uploadOptions, sourcePath)
    };

    start(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("start", torrents.map((torrent) => torrent.hash));
    };

    stop(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("stop", torrents.map((torrent) => torrent.hash));
    };

    verify(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("verify", torrents.map((torrent) => torrent.hash));
    };

    pauseAll(): Promise<void> {
      return invokeAction("pauseAll");
    };

    resumeAll(): Promise<void> {
      return invokeAction("resumeAll");
    };

    queueUp(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("queueUp", torrents.map((torrent) => torrent.hash));
    };

    queueDown(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("queueDown", torrents.map((torrent) => torrent.hash));
    };

    remove(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("remove", torrents.map((torrent) => torrent.hash));
    };

    removeAndLocal(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("removeAndLocal", torrents.map((torrent) => torrent.hash));
    };

    setLocation(torrents: TransmissionTorrent[], location: string): Promise<void> {
      return invokeAction("setLocation", torrents.map((torrent) => torrent.hash), location);
    }

    label(torrents: TransmissionTorrent[], label: string): Promise<void> {
      return invokeAction("label", torrents.map((torrent) => torrent.hash), label);
    }

    deleteTorrents(torrents: TransmissionTorrent[]): Promise<void> {
      return this.remove(torrents)
    }

    protected getTorrentDetailsData(torrent: TransmissionTorrent): Promise<BittorrentTorrentDetailsData> {
      return getTorrentDetails(torrent.hash);
    }

    protected getTorrentDetailsInfoSections(torrent: TransmissionTorrent, details: BittorrentTorrentDetailsData): TorrentDetailsInfoSection[] {
      const info = this.getTorrentDetailsInfo(details);

      return this.compactTorrentDetailsSections([
        this.createTorrentDetailsSection("overview", "Overview", [
          this.createTorrentDetailsField("name", "Name", torrent.name),
          this.createTorrentDetailsField("hash", "Hash", torrent.hash),
          this.createTorrentDetailsField("status", "Status", torrent.statusText()),
          this.createTorrentDetailsField("label", "Label", torrent.label),
          this.createTorrentDetailsField("save-path", "Save Path", info.savePath as string | null, "path"),
          this.createTorrentDetailsField("total-size", "Total Size", this.toNumber(info.totalSize) ?? torrent.size, "bytes"),
          this.createTorrentDetailsField("queue-position", "Queue Position", this.toNumber(info.queuePosition), "number"),
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
        ]),
        this.createTorrentDetailsSection("content", "Content", [
          this.createTorrentDetailsField("piece-size", "Piece Size", this.toNumber(info.pieceSize), "bytes"),
          this.createTorrentDetailsField("pieces", "Pieces", this.toNumber(info.piecesTotal), "number"),
          this.createTorrentDetailsField("sequential-download", "Sequential Download", info.sequentialDownload as boolean | null, "boolean"),
          this.createTorrentDetailsField("private", "Private Torrent", info.isPrivate as boolean | null, "boolean"),
          this.createTorrentDetailsField("created-by", "Created By", info.createdBy as string | null),
          this.createTorrentDetailsField("comment", "Comment", info.comment as string | null, "text", { multiline: true }),
        ]),
        this.createTorrentDetailsSection("swarm", "Swarm", [
          this.createTorrentDetailsField("connections", "Connected Peers", this.toNumber(info.connections), "number"),
          this.createTorrentDetailsField("connections-limit", "Peer Limit", this.toNumber(info.connectionsLimit), "number"),
          this.createTorrentDetailsField("peers", "Peers Sending To Us", this.toNumber(info.peers), "number"),
          this.createTorrentDetailsField("error", "Error", info.errorString as string | null, "text", { multiline: true }),
        ]),
        this.createTorrentDetailsSection("dates", "Dates", [
          this.createTorrentDetailsField("added-on", "Added On", this.toEpochSeconds(info.additionDate), "epoch"),
          this.createTorrentDetailsField("completed-on", "Completed On", this.toEpochSeconds(info.completionDate), "epoch"),
          this.createTorrentDetailsField("created-on", "Created On", this.toEpochSeconds(info.creationDate), "epoch"),
        ]),
      ]);
    }

    private baseActionHeader: TorrentActionList<TransmissionTorrent> = [
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
        click: this.label,
        type: "labels",
      },
    ];

    get actionHeader(): TorrentActionList<TransmissionTorrent> {
      return this.features.labels
        ? this.baseActionHeader
        : this.baseActionHeader.filter((action) => action.type !== "labels")
    }

    contextMenu: ContextActionList<TransmissionTorrent> = [
      {
        id: "torrent-details",
        role: "torrent-details",
        label: "Details",
        click: () => Promise.resolve(),
        icon: "info circle",
      },
      {
        label: "Start",
        click: this.start,
        icon: "play",
      },
      {
        label: "Pause",
        click: this.stop,
        icon: "pause",
      },
      {
        label: "Verify",
        click: this.verify,
        icon: "checkmark",
      },
      {
        label: "Move Up Queue",
        click: this.queueUp,
        icon: "arrow up",
      },
      {
        label: "Move Queue Down",
        click: this.queueDown,
        icon: "arrow down",
      },
      {
        id: "torrent-set-location",
        label: "Set Location",
        click: () => Promise.resolve(),
        icon: "folder open",
      },
      {
        label: "Remove",
        menu: [
          {
            label: "Torrent",
            icon: "remove",
            click: this.remove,
          },
          {
            label: "Torrent and Local Data",
            icon: "remove",
            click: this.removeAndLocal,
            role: "delete",
          },
        ],
      },
    ];
}
