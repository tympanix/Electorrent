import { Column } from "../../services/column";
import { ContextActionList, TorrentActionList, TorrentClient, TorrentUpdates } from "../torrentclient";
import { RtorrentTorrent } from "./torrentr";
import { addTorrentUrl, connect, getSnapshot, invokeAction, uploadTorrent } from "../ipc";

export class RtorrentClient extends TorrentClient<RtorrentTorrent> {
    public name = "rTorrent"
    public id = "rtorrent"

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

    addTorrentUrl(magnet: string): Promise<void> {
      return addTorrentUrl(magnet)
    };

    uploadTorrent(buffer: Uint8Array): Promise<void> {
      return uploadTorrent(buffer, "upload.torrent")
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
