import { ContextActionList, TorrentActionList, TorrentClient, TorrentUpdates, TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { UtorrentTorrent } from "./torrentu";
import { addTorrentUrl, connect, getSnapshot, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";

export class UtorrentClient extends TorrentClient<UtorrentTorrent> {
  public name = "µTorrent"
  public id = "utorrent"
  public uploadOptionsEnable = {
    saveLocation: true,
  }

  build(array: Array<any>): UtorrentTorrent {
    return UtorrentTorrent.fromArray(array)
  }

  defaultPath(): string {
    return "/gui";
  };

  connect(server): Promise<void> {
    return connect(server)
  };

  addTorrentUrl(url: string, options?: TorrentUploadOptions) {
    return addTorrentUrl(url, options)
  };

  uploadTorrent(buffer: Uint8Array, filename?: string, options?: TorrentUploadOptions, sourcePath?: string): Promise<void> {
    return uploadTorrent(buffer, filename || "upload.torrent", options, sourcePath)
  };

  async torrents(): Promise<TorrentUpdates> {
    const res = await getSnapshot();

    return {
      labels: (res.label || []).map(this.labelTransform),
      all: (res.torrents || []).map(this.build),
      changed: (res.torrentp || []).map(this.build),
      deleted: res.torrentm,
    };
  };

  labelTransform(label: string) {
    return label[0];
  }

  start(torrents): Promise<void> {
    return invokeAction("start", torrents.map((torrent) => torrent.hash));
  };

  stop(torrents): Promise<void> {
    return invokeAction("stop", torrents.map((torrent) => torrent.hash));
  };

  pause(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("pause", torrents.map((torrent) => torrent.hash));
  };

  remove(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("remove", torrents.map((torrent) => torrent.hash));
  };

  removedata(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("removedata", torrents.map((torrent) => torrent.hash));
  };

  removetorrent(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("removetorrent", torrents.map((torrent) => torrent.hash));
  };

  removedatatorrent(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("removedatatorrent", torrents.map((torrent) => torrent.hash));
  };

  forcestart(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("forcestart", torrents.map((torrent) => torrent.hash));
  };

  recheck(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("recheck", torrents.map((torrent) => torrent.hash));
  };

  queueup(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("queueup", torrents.map((torrent) => torrent.hash));
  };

  queuedown(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("queuedown", torrents.map((torrent) => torrent.hash));
  };

  getprops(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("getprops", torrents.map((torrent) => torrent.hash));
  };

  deleteTorrents(torrents: UtorrentTorrent[]): Promise<void> {
    return this.removetorrent(torrents)
  }

  setLabel(torrents: UtorrentTorrent[], label: string): Promise<void> {
    return invokeAction("setLabel", torrents.map((torrent) => torrent.hash), label);
  };

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
