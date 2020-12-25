import {Torrent} from "../abstracttorrent";
import {TorrentActionList, TorrentClient, TorrentUpdates, ContextActionList} from "../torrentclient";
import {QBittorrentTorrent} from "./torrentq";

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

const QBittorrent = require("@electorrent/node-qbittorrent");

export class QBittorrentClient extends TorrentClient<QBittorrentTorrent> {


    name = "qBittorrent";

    private qbittorrent: any

    connect(server): Promise<void> {
      let ca = server.getCertificate();

      this.qbittorrent = new QBittorrent({
          host: server.url(),
          port: server.port,
          path: server.cleanPath(),
          user: server.user,
          pass: server.password,
          ca: server.getCertificate(),
      })

      return defer(done => {
        this.qbittorrent.login(done)
      })
    };

    torrents(fullupdate?: boolean): Promise<TorrentUpdates> {
      let p = Promise.resolve()
      if (fullupdate) {
        p = p.then(() => defer(done => this.qbittorrent.reset(done)))
      }

      return p
        .then(() => {
          return defer(done => this.qbittorrent.syncMaindata(done));
        })
        .then((data) => {
          return this.processData(data);
        });
    };

    processData(data: Record<string, any>) {
      var torrents = {
        labels: [],
        all: [],
        changed: [],
        deleted: [],
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

      var torrentArray = [];

      Object.keys(torrents).map(function (hash) {
        var torrent = new QBittorrentTorrent(hash, torrents[hash]);
        torrentArray.push(torrent);
      });

      return torrentArray;
    }

    defaultPath() {
      return "/";
    };

    addTorrentUrl(magnet: string): Promise<void> {
      return defer(done => this.qbittorrent.addTorrentURL(magnet, {}, done));
    };

    uploadTorrent(buffer: Blob, filename: string): Promise<void> {
      let data = Buffer.from(buffer.toString());
      return defer(done => this.qbittorrent.addTorrentFileContent(data, filename, {}, done));
    };

    enableTrackerFilter = false;

    extraColumns = [];

    /*
     * Actions
     */
    resume(torrents: Torrent[]): Promise<void> {
      return defer(done => this.qbittorrent.resume(torrents.map((t) => t.hash), done));
    };

    resumeAll(): Promise<void> {
      return defer(done => this.qbittorrent.resumeAll(done));
    };

    pause(torrents: Torrent[]): Promise<void> {
      return defer(done => this.qbittorrent.pause(torrents.map((t) => t.hash), done));
    };

    pauseAll(): Promise<void> {
      return defer(done => this.qbittorrent.pauseAll(done));
    };

    recheck(torrents: Torrent[]): Promise<void> {
      return defer(done => this.qbittorrent.recheck(torrents.map((t) => t.hash), done));
    };

    increasePrio(torrents: Torrent[]): Promise<void> {
      return defer(done => this.qbittorrent.increasePrio(torrents.map((t) => t.hash), done));
    };

    decreasePrio(torrents: Torrent[]): Promise<void> {
      return defer(done => this.qbittorrent.decreasePrio(torrents.map((t) => t.hash), done));
    };

    topPrio(torrents: Torrent[]): Promise<void> {
      return defer(done => this.qbittorrent.topPrio(torrents.map((t) => t.hash), done));
    };

    bottomPrio(torrents: Torrent[]): Promise<void> {
      return defer(done => this.qbittorrent.bottomPrio(torrents.map((t) => t.hash), done));
    };

    toggleSequentialDownload(torrents: Torrent[]): Promise<void> {
      return defer(done => this.qbittorrent.toggleSequentialDownload(torrents.map((t) => t.hash), done));
    };

    delete(torrents: Torrent[]): Promise<void> {
      return defer(done => this.qbittorrent.delete(torrents.map((t) => t.hash), done));
    };

    deleteAndRemove(torrents: Torrent[]): Promise<void> {
      return defer(done => this.qbittorrent.deleteAndRemove(torrents.map((t) => t.hash), done));
    };

    setCategory(torrents: Torrent[], category: string, create?: boolean): Promise<void> {
      let promise = Promise.resolve()
      if (create === true) {
        promise = promise.then(() => defer(done => this.qbittorrent.createCategory(category, "", done)));
      }
      let hashes = torrents.map((t) => t.hash);
      return promise.then(() => defer(done => this.qbittorrent.setCategory(hashes, category, done)));
    };

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

    /**
     * Represents the actions available in the context menu. Can be customized to your liking or
     * to better accommodate your bittorrent client. Every action must have a click function implemented.
     * Each element has an:
     *      label [string]:     The name of the action
     *      click [function]:   The function to be executed when clicked
     *      icon [string]:      The icon of the action. See here: http://semantic-ui.com/elements/icon.html
     *      check [function]:   Displays a checkbox instead of an icon. The function is a predicate which
     *                          has to hold for all selected torrents, for the checkbox to be checked.
     */
    contextMenu: ContextActionList<QBittorrentTorrent> = [
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

