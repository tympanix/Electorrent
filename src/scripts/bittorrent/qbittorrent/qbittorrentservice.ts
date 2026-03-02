import {Torrent} from "../abstracttorrent";
import {TorrentActionList, TorrentClient, TorrentUpdates, ContextActionList, TorrentUploadOptions, TorrentUploadOptionsEnable} from "../torrentclient";
import {TorrentFile} from "../abstracttorrent";
import {QBittorrentTorrent} from "./torrentq";

type CallbackFunc = (err: any, val: any) => void

function defer<T>(fn: (f: CallbackFunc) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((err, val) => {
      if (err) {
        reject(err)
      } else {
        resolve(val)
      }
    })
  })
}

export interface QBittorrentUploadOptions {
  savepath?: string
  cookie?: string
  category?: string
  tags?: string
  skip_checking?: boolean
  paused?: boolean // api v4
  stopped?: boolean // api v5
  root_folder?: boolean
  rename?: string
  upLimit?: number
  dlLimit?: number
  autoTMM?: boolean
  sequentialDownload?: boolean
  firstLastPiecePrio?: boolean
}

type QBittorrentUploadFormData = Partial<Record<keyof QBittorrentUploadOptions, string | Uint8Array | Buffer>>

const QBittorrent = require("@electorrent/node-qbittorrent");

/** qBittorrent file priority: 0 = do not download, 1 = normal, 2 = high, 6 = maximal */
const QBITTORRENT_PRIORITY_SKIP = 0;
const QBITTORRENT_PRIORITY_NORMAL = 1;

export class QBittorrentClient extends TorrentClient<QBittorrentTorrent> {

    public name = "qBittorrent"
    public id = "qbittorrent"

    public supportsFileSelection = true

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

    /**
     * Transforms generic upload options to QBittorrent spefific ones. Options are returned in
     * a form data compatible format accepted by the QBittorrent API. The returned object can
     * be used directly in a HTTP post request
     */
    private getHttpUploadOptions(options: TorrentUploadOptions): QBittorrentUploadFormData {
      let qbittorrentOptions: Required<QBittorrentUploadOptions> = {
        savepath: options.saveLocation,
        cookie: undefined,
        category: options.category,
        tags: undefined,
        skip_checking: options.skipCheck,
        paused: !options.startTorrent,
        stopped: !options.startTorrent,
        root_folder: undefined,
        rename: options.renameTorrent,
        upLimit: options.uploadSpeedLimit,
        dlLimit: options.downloadSpeedLimit,
        autoTMM: undefined,
        sequentialDownload: options.sequentialDownload,
        firstLastPiecePrio: options.firstAndLastPiecePrio,
      }
      let formData: QBittorrentUploadFormData = {}
      // remove values which are undefined and transform into http form style
      for (let k in qbittorrentOptions) {
        if (qbittorrentOptions[k] !== undefined && qbittorrentOptions[k] !== null) {
          formData[k] = qbittorrentOptions[k].toString()
        }
      }
      return formData
    }

    uploadTorrent(buffer: Uint8Array, filename: string, options: TorrentUploadOptions): Promise<void> {
      let data = Buffer.from(buffer);
      let httpFormOptions = undefined
      if (options !== undefined) {
        httpFormOptions = this.getHttpUploadOptions(options)
      }
      return defer(done => this.qbittorrent.addTorrentFileContent(data, filename, httpFormOptions, done));
    };

    addTorrentUrl(magnet: string, options?: TorrentUploadOptions): Promise<void> {
      let httpFormOptions = undefined
      if (options !== undefined) {
        httpFormOptions = this.getHttpUploadOptions(options)
      }
      return defer(done => this.qbittorrent.addTorrentURL(magnet, httpFormOptions, done));
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

    /**
     * Delete function to satisfy interface implementation
     * @param torrents torrent to delete
     * @returns promise that torrents were deleted
     */
    deleteTorrents(torrents: QBittorrentTorrent[]): Promise<void> {
      return this.delete(torrents)
    }

    async getTorrentFiles(torrent: QBittorrentTorrent): Promise<TorrentFile[]> {
      const api = (this.qbittorrent as any).api;
      if (!api || typeof api.getJson !== 'function') {
        return Promise.reject(new Error('qBittorrent API does not support getTorrentFiles'));
      }
      return new Promise((resolve, reject) => {
        api.getJson('torrents/files', { qs: { hash: torrent.hash } }, (err: any, _res: any, body: any) => {
          if (err) return reject(err);
          if (!Array.isArray(body)) return reject(new Error('Invalid response'));
          const files: TorrentFile[] = body.map((f: any, idx: number) => ({
            index: f.index != null ? f.index : idx,
            path: f.name || '',
            name: (f.name || '').split(/[/\\]/).pop() || '',
            size: typeof f.size === 'number' ? f.size : (parseInt(String(f.size), 10) || 0),
            wanted: (f.priority != null ? f.priority : 1) !== QBITTORRENT_PRIORITY_SKIP,
            priority: f.priority,
          }));
          resolve(files);
        });
      });
    }

    async setTorrentFileSelection(torrent: QBittorrentTorrent, files: TorrentFile[]): Promise<void> {
      const api = (this.qbittorrent as any).api;
      if (!api || typeof api.post !== 'function') {
        return Promise.reject(new Error('qBittorrent API does not support setTorrentFileSelection'));
      }
      const wantedIds: number[] = [];
      const unwantedIds: number[] = [];
      files.forEach((f) => {
        if (f.wanted) wantedIds.push(f.index);
        else unwantedIds.push(f.index);
      });
      const setPrio = (ids: number[], priority: number) =>
        new Promise<void>((resolve, reject) => {
          if (ids.length === 0) return resolve();
          api.post('torrents/filePrio', {
            form: { hash: torrent.hash, id: ids.join('|'), priority: String(priority) },
          }, (err: any) => (err ? reject(err) : resolve()));
        });
      await setPrio(unwantedIds, QBITTORRENT_PRIORITY_SKIP);
      await setPrio(wantedIds, QBITTORRENT_PRIORITY_NORMAL);
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

