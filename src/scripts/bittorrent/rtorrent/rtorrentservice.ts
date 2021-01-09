import {Column} from "../../services/column";
import {ContextActionList, TorrentActionList, TorrentClient, TorrentUpdates} from "../torrentclient";
import {RtorrentTorrent} from "./torrentr";

const Rtorrent = require("@electorrent/node-rtorrent");

type CallbackFunc = (err: any, val: any) => void
function defer<T>(fn: (f: CallbackFunc) => void): Promise<T> {
  return new Promise((reject, resolve) => {
    fn((err, val) => {
      if (err) {
        reject(err)
      } else {
        resolve(val)
      } 
    })
  })
}

export class RtorrentClient extends TorrentClient<RtorrentTorrent> {

    /*
     * Global reference to the rtorrent remote web worker instance
     */
    rtorrent = null;

    name = "rTorrent";

    connect(server): Promise<void> {
        let ca = server.getCertificate();

        this.rtorrent = new Rtorrent({
          host: server.ip,
          port: server.port,
          path: server.cleanPath(),
          user: server.user,
          pass: server.password,
          ssl: server.isHTTPS(),
          ca: ca,
        })

        return defer((done) => {
          this.rtorrent.get("system.client_version", [], done);
        })
    };

    defaultPath(): string {
      return "/RPC2";
    };


    async torrents(): Promise<TorrentUpdates> {
      var torrents = {
        dirty: true,
        labels: [],
        all: [],
        changed: [],
        deleted: [],
        trackers: [],
      };

      let data: Record<string, any> = defer((done) => {
        this.rtorrent.getTorrentsExtra(done)
      })
     
      torrents.all = data.torrents.map((d: Record<string, any>) => new RtorrentTorrent(d));
      torrents.trackers = data.trackers;
      torrents.labels = data.labels;
      return torrents;
    };

    addTorrentUrl(magnet: string): Promise<void> {
      return defer((done) => {
        this.rtorrent.loadLink(magnet, done);
      })
    };

    async uploadTorrent(buffer: Blob): Promise<void> {
      let data = Buffer.from(await buffer.arrayBuffer());
      return defer((done) => {
        this.rtorrent.loadFileContent(data, done);
      })
    };

    start(torrents: RtorrentTorrent[]): Promise<void> {
      return defer((done) => {
        this.rtorrent.start(torrents.map((t) => t.hash), done);
      })
    };

    stop(torrents: RtorrentTorrent[]): Promise<void> {
      return defer((done) => {
        this.rtorrent.stop(torrents.map((t) => t.hash), done);
      })
    };

    label(torrents: RtorrentTorrent[], label: string): Promise<void> {
      return defer((done) => {
        this.rtorrent.setLabel( torrents.map((t) => t.hash), label, done);
      })
    };

    remove(torrents: RtorrentTorrent[]): Promise<void> {
      return defer((done) => {
        this.rtorrent.remove(torrents.map((t) => t.hash), done);
      })
    };

    deleteAndErase(torrents: RtorrentTorrent[]): Promise<void> {
      return defer((done) => {
        this.rtorrent.removeAndErase(torrents.map((t) => t.hash), done);
      })
    };

    recheck(torrents: RtorrentTorrent[]): Promise<void> {
      return defer((done) => {
        this.rtorrent.recheck(torrents.map((t) => t.hash), done);
      })
    };

    priorityHigh(torrents: RtorrentTorrent[]): Promise<void> {
      return defer((done) => {
        this.rtorrent.setPriorityHigh(torrents.map((t) => t.hash), done);
      })
    };

    priorityNormal(torrents: RtorrentTorrent[]): Promise<void> {
      return defer((done) => {
        this.rtorrent.setPriorityNormal(torrents.map((t) => t.hash), done);
      })
    };

    priorityLow(torrents: RtorrentTorrent[]): Promise<void> {
      return defer((done) => {
        this.rtorrent.setPriorityLow(torrents.map((t) => t.hash), done);
      })
    };

    priorityOff(torrents: RtorrentTorrent[]): Promise<void> {
      return defer((done) => {
        this.rtorrent.setPriorityOff(torrents.map((t) => t.hash), done);
      })
    };

    /**
     * Whether the client supports sorting by trackers or not
     */
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

