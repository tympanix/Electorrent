import { TorrentActionList, TorrentClient, TorrentDetailsInfoSection, TorrentRatioLimitOptions, TorrentSpeedLimitOptions, TorrentUpdates, TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { Torrent } from "@renderer/app/bittorrent/abstracttorrent";
import { TransmissionTorrent } from "./torrentt";
import _ from "underscore"
import { addTorrentUrl, getSnapshot, getTorrentDetails, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";
import type { BittorrentTorrentDetailsData } from "@shared/ipc-contract";
import { applyFreeDiskSpace } from "@renderer/app/bittorrent/free-disk-space";

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
      return applyFreeDiskSpace(torrents, data?.arguments?.freeDiskSpace);
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
      return invokeAction("start", torrents.map((torrent) => torrent.id));
    };

    stop(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("stop", torrents.map((torrent) => torrent.id));
    };

    verify(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("verify", torrents.map((torrent) => torrent.id));
    };

    pauseAll(): Promise<void> {
      return invokeAction("pauseAll");
    };

    resumeAll(): Promise<void> {
      return invokeAction("resumeAll");
    };

    queueUp(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("queueUp", torrents.map((torrent) => torrent.id));
    };

    queueDown(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("queueDown", torrents.map((torrent) => torrent.id));
    };

    remove(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("remove", torrents.map((torrent) => torrent.id));
    };

    removeAndLocal(torrents: TransmissionTorrent[]): Promise<void> {
      return invokeAction("removeAndLocal", torrents.map((torrent) => torrent.id));
    };

    setLocation(torrents: TransmissionTorrent[], location: string): Promise<void> {
      return invokeAction("setLocation", torrents.map((torrent) => torrent.id), location);
    }

    label(torrents: TransmissionTorrent[], label: string): Promise<void> {
      return invokeAction("label", torrents.map((torrent) => torrent.id), label);
    }

    deleteTorrents(torrents: TransmissionTorrent[]): Promise<void> {
      return this.remove(torrents)
    }

    setSpeedLimits(torrents: TransmissionTorrent[], options: TorrentSpeedLimitOptions): Promise<void> {
      return invokeAction("setSpeedLimits", torrents.map((torrent) => torrent.id), options);
    }

    setRatioLimit(torrents: TransmissionTorrent[], options: TorrentRatioLimitOptions): Promise<void> {
      return invokeAction("setRatioLimit", torrents.map((torrent) => torrent.id), options);
    }

    extraColumns = [
      Torrent.COL_DOWNLIMIT,
      Torrent.COL_UPLIMIT,
      TransmissionTorrent.COL_AVAILABILITY,
      TransmissionTorrent.COL_REMAINING,
      TransmissionTorrent.COL_FILES,
      TransmissionTorrent.COL_ACTIVE_TIME,
      TransmissionTorrent.COL_SEEDING_TIME,
      TransmissionTorrent.COL_LAST_ACTIVITY,
      TransmissionTorrent.COL_STARTED_ON,
      TransmissionTorrent.COL_GROUP,
      TransmissionTorrent.COL_TRACKER,
      TransmissionTorrent.COL_WASTED,
      TransmissionTorrent.COL_BANDWIDTH_PRIORITY,
      TransmissionTorrent.COL_PRIVATE,
      TransmissionTorrent.COL_STALLED,
    ];

    protected getTorrentDetailsData(torrent: TransmissionTorrent): Promise<BittorrentTorrentDetailsData> {
      return getTorrentDetails(torrent.id);
    }

    protected getTorrentDetailsInfoSections(torrent: TransmissionTorrent, details: BittorrentTorrentDetailsData): TorrentDetailsInfoSection[] {
      const info = this.getTorrentDetailsInfo(details);
      const toSpeedLimitBytes = (value: unknown) => {
        const limit = this.toNumber(value);
        return limit == null ? null : limit * 1024;
      };

      return this.compactTorrentDetailsSections([
        this.createTorrentDetailsSection("overview", "Overview", [
          this.createTorrentDetailsField("name", "Name", torrent.name),
          this.createTorrentDetailsField("hash", "Hash", torrent.hash),
          this.createTorrentDetailsField("status", "Status", torrent.statusText()),
          this.createTorrentDetailsField("label", "Label", torrent.label),
          this.createTorrentDetailsField("save-path", "Save Path", info.savePath as string | null, "path"),
          this.createTorrentDetailsField("total-size", "Total Size", this.toNumber(info.totalSize) ?? torrent.size, "bytes"),
          this.createTorrentDetailsField("size-when-done", "Size When Done", this.toNumber(info.sizeWhenDone), "bytes"),
          this.createTorrentDetailsField("queue-position", "Queue Position", this.toNumber(info.queuePosition), "number"),
          this.createTorrentDetailsField("group", "Bandwidth Group", info.group as string | null),
          this.createTorrentDetailsField("torrent-file", "Torrent File", info.torrentFile as string | null, "path"),
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
          this.createTorrentDetailsField("eta-idle", "Seeding ETA", this.toEpochSeconds(info.etaIdle), "eta"),
          this.createTorrentDetailsField("active-time", "Active Time", this.toNumber(info.timeElapsed), "eta"),
          this.createTorrentDetailsField("downloading-time", "Downloading Time", this.toNumber(info.secondsDownloading), "eta"),
          this.createTorrentDetailsField("seeding-time", "Seeding Time", this.toNumber(info.secondsSeeding), "eta"),
          this.createTorrentDetailsField("remaining", "Remaining", this.toNumber(info.leftUntilDone), "bytes"),
          this.createTorrentDetailsField("available-to-download", "Available To Download", this.toNumber(info.desiredAvailable), "bytes"),
          this.createTorrentDetailsField("valid-data", "Verified Data", this.toNumber(info.haveValid), "bytes"),
          this.createTorrentDetailsField("unchecked-data", "Unchecked Data", this.toNumber(info.haveUnchecked), "bytes"),
          this.createTorrentDetailsField("wasted", "Wasted", this.toNumber(info.corruptEver), "bytes"),
          this.createTorrentDetailsField("bandwidth-priority", "Bandwidth Priority", this.bandwidthPriorityText(info.bandwidthPriority), "text"),
          this.createTorrentDetailsField("honors-session-limits", "Honor Session Limits", info.honorsSessionLimits as boolean | null, "boolean"),
          this.createTorrentDetailsField("seed-idle-limit", "Seed Idle Limit", this.toNumber(info.seedIdleLimit), "number"),
          this.createTorrentDetailsField("seed-idle-mode", "Seed Idle Mode", this.seedIdleModeText(info.seedIdleMode)),
        ]),
        this.createTorrentDetailsSection("content", "Content", [
          this.createTorrentDetailsField("piece-size", "Piece Size", this.toNumber(info.pieceSize), "bytes"),
          this.createTorrentDetailsField("pieces", "Pieces", this.toNumber(info.piecesTotal), "number"),
          this.createTorrentDetailsField("files", "Files", this.toNumber(info.fileCount), "number"),
          this.createTorrentDetailsField("metadata-progress", "Metadata Complete", this.toPercent(info.metadataPercentComplete), "percent"),
          this.createTorrentDetailsField("content-progress", "Content Complete", this.toPercent(info.percentComplete), "percent"),
          this.createTorrentDetailsField("availability", "Availability", this.toPercent(info.availability), "percent"),
          this.createTorrentDetailsField("sequential-download", "Sequential Download", info.sequentialDownload as boolean | null, "boolean"),
          this.createTorrentDetailsField("private", "Private Torrent", info.isPrivate as boolean | null, "boolean"),
          this.createTorrentDetailsField("finished", "Finished", info.isFinished as boolean | null, "boolean"),
          this.createTorrentDetailsField("stalled", "Stalled", info.isStalled as boolean | null, "boolean"),
          this.createTorrentDetailsField("mime-type", "Content Type", info.primaryMimeType as string | null),
          this.createTorrentDetailsField("magnet-link", "Magnet Link", info.magnetLink as string | null, "text", { multiline: true }),
          this.createTorrentDetailsField("created-by", "Created By", info.createdBy as string | null),
          this.createTorrentDetailsField("comment", "Comment", info.comment as string | null, "text", { multiline: true }),
        ]),
        this.createTorrentDetailsSection("swarm", "Swarm", [
          this.createTorrentDetailsField("connections", "Connected Peers", this.toNumber(info.connections), "number"),
          this.createTorrentDetailsField("connections-limit", "Peer Limit", this.toNumber(info.connectionsLimit), "number"),
          this.createTorrentDetailsField("downloading-from", "Peers Sending To Us", this.toNumber(info.peersSendingToUs), "number"),
          this.createTorrentDetailsField("uploading-to", "Peers Getting From Us", this.toNumber(info.peersGettingFromUs), "number"),
          this.createTorrentDetailsField("webseeds", "Web Seeds", this.toNumber(info.webseeds), "number"),
          this.createTorrentDetailsField("active-webseeds", "Active Web Seeds", this.toNumber(info.webseedsSendingToUs), "number"),
          this.createTorrentDetailsField("peers-from-tracker", "Peers From Tracker", this.toNumber(info.peersFromTracker), "number"),
          this.createTorrentDetailsField("peers-from-dht", "Peers From DHT", this.toNumber(info.peersFromDht), "number"),
          this.createTorrentDetailsField("peers-from-pex", "Peers From PEX", this.toNumber(info.peersFromPex), "number"),
          this.createTorrentDetailsField("peers-from-lpd", "Peers From LPD", this.toNumber(info.peersFromLpd), "number"),
          this.createTorrentDetailsField("peers-from-ltep", "Peers From LTEP", this.toNumber(info.peersFromLtep), "number"),
          this.createTorrentDetailsField("peers-from-incoming", "Incoming Peers", this.toNumber(info.peersFromIncoming), "number"),
          this.createTorrentDetailsField("peers-from-cache", "Peers From Cache", this.toNumber(info.peersFromCache), "number"),
          this.createTorrentDetailsField("error", "Error", info.errorString as string | null, "text", { multiline: true }),
        ]),
        this.createTorrentDetailsSection("dates", "Dates", [
          this.createTorrentDetailsField("added-on", "Added On", this.toEpochSeconds(info.additionDate), "epoch"),
          this.createTorrentDetailsField("completed-on", "Completed On", this.toEpochSeconds(info.completionDate), "epoch"),
          this.createTorrentDetailsField("created-on", "Created On", this.toEpochSeconds(info.creationDate), "epoch"),
          this.createTorrentDetailsField("started-on", "Started On", this.toEpochSeconds(info.startDate), "epoch"),
          this.createTorrentDetailsField("last-activity", "Last Activity", this.toEpochSeconds(info.activityDate), "epoch"),
          this.createTorrentDetailsField("last-edited", "Last Edited", this.toEpochSeconds(info.editDate), "epoch"),
        ]),
      ]);
    }

    private bandwidthPriorityText(value: unknown): string | null {
      const priority = this.toNumber(value)
      return priority == null ? null : ({ [-1]: "Low", [0]: "Normal", [1]: "High" })[priority] || String(priority)
    }

    private seedIdleModeText(value: unknown): string | null {
      const mode = this.toNumber(value)
      return mode == null ? null : ({ [0]: "Global", [1]: "Torrent", [2]: "Unlimited" })[mode] || String(mode)
    }

    private toPercent(value: unknown): number | null {
      return this.toNumber(value)
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
}
