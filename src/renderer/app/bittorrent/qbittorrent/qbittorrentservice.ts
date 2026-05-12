import { Torrent } from "../abstracttorrent";
import { TorrentActionList, TorrentClient, TorrentUpdates, ContextActionList, TorrentUploadOptions, TorrentUploadOptionsEnable } from "../torrentclient";
import { TorrentFile } from "../abstracttorrent";
import { QBittorrentTorrent } from "./torrentq";
import { addTorrentUrl, connect, getSnapshot, getTorrentFiles, invokeAction, setTorrentFileSelection, uploadTorrent } from "../ipc";

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

    uploadTorrent(buffer: Uint8Array, filename: string, options: TorrentUploadOptions): Promise<void> {
      return uploadTorrent(buffer, filename, options);
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
