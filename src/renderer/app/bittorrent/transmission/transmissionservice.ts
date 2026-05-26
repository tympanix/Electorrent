import { ContextActionList, TorrentActionList, TorrentClient, TorrentUpdates, TorrentUploadOptions, TorrentUploadOptionsEnable } from "@renderer/app/bittorrent/torrentclient";
import { TransmissionTorrent } from "./torrentt";
import _ from "underscore"
import { addTorrentUrl, connect, getSnapshot, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";

const URL_REGEX = /^[a-z]+:\/\/(?:[a-z0-9-]+\.)*((?:[a-z0-9-]+\.)[a-z]+)/;

export class TransmissionClient extends TorrentClient<TransmissionTorrent> {
    public name = "Transmission";
    public id = "transmission"
    public supportsSetLocation = true

    public uploadOptionsEnable: TorrentUploadOptionsEnable = {
      saveLocation: true,
      startTorrent: true,
    }

    connect(server): Promise<void> {
      return connect(server)
    };

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

    uploadTorrent(buffer: Uint8Array, filename?: string, uploadOptions?: TorrentUploadOptions): Promise<void> {
      return uploadTorrent(buffer, filename || "upload.torrent", uploadOptions)
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

    deleteTorrents(torrents: TransmissionTorrent[]): Promise<void> {
      return this.remove(torrents)
    }

    enableTrackerFilter = true;

    actionHeader: TorrentActionList<TransmissionTorrent> = [
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
    ];

    contextMenu: ContextActionList<TransmissionTorrent> = [
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
