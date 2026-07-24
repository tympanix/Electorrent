import { TorrentActionList, TorrentClient, TorrentRatioLimitOptions, TorrentSpeedLimitOptions, TorrentUpdates, TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { UtorrentTorrent } from "./torrentu";
import { addTorrentUrl, getSnapshot, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";

export class UtorrentClient extends TorrentClient<UtorrentTorrent> {
  public name = "µTorrent"
  public id = "utorrent"
  build = (array: Array<any>): UtorrentTorrent => UtorrentTorrent.fromApiArray(array)

  defaultPath(): string {
    return "/gui";
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
    return invokeAction("start", torrents.map((torrent) => torrent.id));
  };

  stop(torrents): Promise<void> {
    return invokeAction("stop", torrents.map((torrent) => torrent.id));
  };

  pause(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("pause", torrents.map((torrent) => torrent.id));
  };

  remove(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("remove", torrents.map((torrent) => torrent.id));
  };

  removedata(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("removedata", torrents.map((torrent) => torrent.id));
  };

  removetorrent(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("removetorrent", torrents.map((torrent) => torrent.id));
  };

  removedatatorrent(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("removedatatorrent", torrents.map((torrent) => torrent.id));
  };

  forcestart(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("forcestart", torrents.map((torrent) => torrent.id));
  };

  recheck(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("recheck", torrents.map((torrent) => torrent.id));
  };

  queueup(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("queueup", torrents.map((torrent) => torrent.id));
  };

  queuedown(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("queuedown", torrents.map((torrent) => torrent.id));
  };

  getprops(torrents: UtorrentTorrent[]): Promise<void> {
    return invokeAction("getprops", torrents.map((torrent) => torrent.id));
  };

  deleteTorrents(torrents: UtorrentTorrent[]): Promise<void> {
    return this.removetorrent(torrents)
  }

  setLabel(torrents: UtorrentTorrent[], label: string): Promise<void> {
    return invokeAction("setLabel", torrents.map((torrent) => torrent.id), label);
  };

  setSpeedLimits(torrents: UtorrentTorrent[], options: TorrentSpeedLimitOptions): Promise<void> {
    return invokeAction("setSpeedLimits", torrents.map((torrent) => torrent.id), options);
  }

  async setRatioLimit(torrents: UtorrentTorrent[], options: TorrentRatioLimitOptions): Promise<void> {
    const ids = torrents.map((torrent) => torrent.id);
    await invokeAction("setRatioLimit", ids, options);
    await invokeAction("getprops", ids);
  };

  private baseActionHeader: TorrentActionList<UtorrentTorrent> = [
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

  get actionHeader(): TorrentActionList<UtorrentTorrent> {
    return this.features.labels
      ? this.baseActionHeader
      : this.baseActionHeader.filter((action) => action.type !== "labels")
  }
}
