import {Column} from "../../services/column";
import {ContextActionList, TorrentActionList, TorrentClient, TorrentUpdates, TorrentUploadOptions} from "../torrentclient";
import {UtorrentTorrent} from "./torrentu";
import axios from "axios";
import { AxiosInstance } from "axios";
import { default as FormData } from "form-data"
import https from "https"
import qs from "qs";

export class UtorrentClient extends TorrentClient<UtorrentTorrent> {
  server = undefined;
  http: AxiosInstance = undefined;
  name = "µTorrent";

  data = {
    url: null,
    username: null,
    password: null,
    token: null,
    cid: 0,
    build: -1,
  };

  build(array: Array<any>): UtorrentTorrent {
    return UtorrentTorrent.fromArray(array)
  }

  extractTokenFromHTML(str: string) {
    var match = str.match(/>([^<]+)</);
    if (match) {
      this.data.token = match[match.length - 1];
      return true;
    }
    return false;
  }

  handleError(value) {
    let json = null;
    if (typeof value === "object") {
      json = value;
    } else {
      try {
        json = JSON.parse(value);
      } catch {
        return;
      }
    }
    if (json.error !== null && json.error !== undefined) {
      throw new Error(json.error);
    }
    if (typeof json.data === "object") {
      this.handleError(json.data);
    }
  }

  bufferToUnit8Array(buf: Buffer) {
    if (!buf) return undefined;
    if (buf.constructor.name === "Uint8Array" || buf.constructor === Uint8Array) {
      return buf;
    }
    if (typeof buf === "string") buf = Buffer.from(buf);
    var a = new Uint8Array(buf.length);
    for (var i = 0; i < buf.length; i++) a[i] = buf[i];
    return a;
  }

  url(path?: string) {
    return `${this.server.url()}${path || ""}`;
  };

  saveConnection(url: string, username: string, password: string) {
    this.data.username = username;
    this.data.password = password;
    this.data.url = url;
  };

  /**
   * Returns the default path for the service. Should start with a slash.
   @return {string} the default path
   */
  defaultPath(): string {
    return "/gui";
  };

  async connect(server) {
    this.server = server;
    let self = this;

    // Create axios instance with authentication
    this.http = axios.create({
      auth: {
        username: server.user,
        password: server.password,
      },
      httpsAgent: new https.Agent({
        ca: this.server.getCertificate()
      }),
      paramsSerializer: (params) => {
        return qs.stringify(params, { arrayFormat: 'repeat' })
      },
      adapter: require("axios/lib/adapters/http")
    })

    // The µTorrent client will respond with a "cid" (context id) number which is
    // used for incremental updates
    this.http.interceptors.response.use((res) => {
      if (res.data && res.data.torrentc !== undefined) {
        this.data.cid = res.data.torrentc;
      }
      return res
    })

    // Unlike in the browser, there is no cookie handling when using Axios in NodeJS.
    // Implement simple interceptor to store cookies and set request headers
    this.http.interceptors.response.use((res) => {
      let cookie = res.headers["set-cookie"]
      if (cookie && cookie.length) {
        this.http.defaults.headers.common["Cookie"] = cookie[0]
      }
      return res
    })

    // If json response contains an "error" attribute an exception is thrown
    this.http.interceptors.response.use((res) => {
      let error = res?.data?.error
      if (typeof error === "string") {
        throw new Error(error)
      }
      return res
    })

    let res = await this.http.get(this.url() + "/token.html", {
      timeout: 5000,
      params: {
        t: Date.now()
      },
    })
    if (res.status == 401 || res.status == 402) {
      throw new Error("Invalid credentials")
    }
    if (res.status != 200) {
      throw new Error("Invalid information provided to server")
    }
    if (this.extractTokenFromHTML(res.data)) {
      self.saveConnection(server.url(), server.user, server.password)
    } else {
      throw Error("Failed to authenticate with server")
    }
  };

  async addTorrentUrl(url: string, options?: TorrentUploadOptions) {
    await this.http.get(this.data.url + "/", {
      params: {
        token: this.data.token,
        t: Date.now(),
        action: "add-url",
        s: url,
        download_dir: options.saveLocation || 0,
        path: "",
      },
    })
  };

  async uploadTorrent(buffer: Uint8Array, filename?: string, options?: TorrentUploadOptions): Promise<void> {
    if (options === undefined || options === null) {
      options = {}
    }

    var formData = new FormData();
    formData.append("torrent_file", Buffer.from(buffer), {
      filename: filename,
      contentType: "application/x-bittorrent",
    });

    let contentLength = await new Promise((resolve, reject) => {
      formData.getLength((err, length) => {
        err ? reject(err) : resolve(length)
      })
    })

    return this.http
      .post(this.data.url + "/", formData, {
        params: {
          token: this.data.token,
          action: "add-file",
          download_dir: options.saveLocation || 0,
          path: "",
        },
        headers: {
          ...formData.getHeaders(),
          "Content-Length": contentLength.toString(),
        },
      })
  };

  async torrents(): Promise<TorrentUpdates> {
    var torrents = {
      labels: [],
      all: [],
      changed: [],
      deleted: [],
    };

    let res = await this.http.get(this.data.url + "/", {
        params: {
          token: this.data.token,
          cid: this.data.cid,
          t: Date.now(),
          list: 1,
        }
      },
    );

    torrents.labels = (res.data.label || []).map(this.labelTransform);
    torrents.all = (res.data.torrents || []).map(this.build);
    torrents.changed = (res.data.torrentp || []).map(this.build);
    torrents.deleted = res.data.torrentm;

    return torrents
  };

  labelTransform(label: string) {
    return label[0];
  }

  async doAction(action: string, torrents: UtorrentTorrent[]): Promise<void> {
    var hashes = torrents.map(function (torrent) {
      return torrent.hash;
    });

    await this.http.get(this.data.url + "/", {
      params: {
        action: action,
        hash: hashes,
        token: this.data.token,
        cid: this.data.cid,
        t: Date.now(),
      }
    })
  }

  async start(torrents): Promise<void> {
    return this.doAction("start", torrents);
  };

  async stop(torrents): Promise<void> {
    return this.doAction("stop", torrents);
  };

  async pause(torrents: UtorrentTorrent[]): Promise<void> {
    return this.doAction("pause", torrents);
  };

  async remove(torrents: UtorrentTorrent[]): Promise<void> {
    return this.doAction("remove", torrents);
  };

  async removedata(torrents: UtorrentTorrent[]): Promise<void> {
    return this.doAction("removedata", torrents);
  };

  async removetorrent(torrents: UtorrentTorrent[]): Promise<void> {
    return this.doAction("removetorrent", torrents);
  };

  async removedatatorrent(torrents: UtorrentTorrent[]): Promise<void> {
    return this.doAction("removedatatorrent", torrents);
  };

  async forcestart(torrents: UtorrentTorrent[]): Promise<void> {
    return this.doAction("forcestart", torrents);
  };

  async recheck(torrents: UtorrentTorrent[]): Promise<void> {
    return this.doAction("recheck", torrents);
  };

  async queueup(torrents: UtorrentTorrent[]): Promise<void> {
    return this.doAction("queueup", torrents);
  };

  async queuedown(torrents: UtorrentTorrent[]): Promise<void> {
    return this.doAction("queuedown", torrents);
  };

  async getprops(torrents: UtorrentTorrent[]): Promise<void> {
    return this.doAction("getprops", torrents);
  };

  /**
   * Delete function to satisfy interface implementation
   * @param torrents torrent to delete from client
   */
  deleteTorrents(torrents: UtorrentTorrent[]): Promise<void> {
    return this.removetorrent(torrents)
  }


  setLabel(torrents: UtorrentTorrent[], label: string): Promise<void> {
    var hashes = torrents.map(function (torrent) {
      return torrent.hash;
    });

    return this.http.get(this.data.url + "/", {
      params: {
        token: this.data.token,
        hash: hashes,
        s: "label",
        v: label,
        action: "setprops",
        t: Date.now(),
      },
    });
  };

  async getDownloadDirectories() {
    let res = await this.http.get(
      this.data.url + "/",
      {
        params: {
          token: this.data.token,
          t: Date.now(),
          action: "list-dirs"
        }
      }
    )
    return res.data["download-dirs"]
  };

  async filePriority(torrent: UtorrentTorrent, priority: string) {
    return await this.http.get(
      this.data.url + "/" + "?token=:token&action=setprio&hash=:hash&t=:t&p=:priority",
      {
        params: {
          token: this.data.token,
          t: Date.now(),
          action: "setprio",
          hash: torrent.hash,
          p: priority,
        }
      }
    );
  };

  getVersion() {
    var buildVersionStr = function () {
      var prefix = "μTorrent";
      var preBuild = "build";
      return [prefix, preBuild, this.data.build].join(" ");
    };

    if (this.data.build === -1) {
      return "";
    }
    return buildVersionStr();
  };

  // columns = [
  //   new Column("Name", "text", "decodedName"),
  //   new Column("Size", "text", "size", "bytes"),
  //   new Column("Down", "text", "downloadSpeed", "speed"),
  //   new Column("Progress", "progress"),
  //   new Column("Label", "text", "label"),
  //   new Column("Date Added", "text", "dateAdded", "date"),
  // ];

  actionHeader: TorrentActionList<UtorrentTorrent> = [
    {
      label: "Start",
      type: "button",
      color: "green",
      click: this.start,
      icon: "play",
      role: "resume",
    },
    {
      label: "Pause",
      type: "button",
      color: "yellow",
      click: this.pause,
      icon: "pause",
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
      click: this.setLabel,
      type: "labels",
    },
  ];

  contextMenu: ContextActionList<UtorrentTorrent> = [
    {
      label: "Recheck",
      click: this.recheck,
      icon: "checkmark",
    },
    {
      label: "Force Start",
      click: this.forcestart,
      icon: "flag",
    },
    {
      label: "Move Up Queue",
      click: this.queueup,
      icon: "arrow up",
    },
    {
      label: "Move Queue Down",
      click: this.queuedown,
      icon: "arrow down",
    },
    {
      label: "Remove",
      click: this.remove,
      icon: "remove",
      role: "delete",
    },
    {
      label: "Remove And",
      menu: [
        {
          label: "Delete Torrent",
          click: this.removetorrent,
        },
        {
          label: "Delete Data",
          click: this.removedata,
        },
        {
          label: "Delete All",
          click: this.removedatatorrent,
        },
      ],
    },
  ];

}