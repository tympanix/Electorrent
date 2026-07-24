import { TorrentActionList, TorrentClient, TorrentUpdates, TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { SynologyTorrent } from "./synologytorrent";
import { addTorrentUrl, getSnapshot, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";

export class SynologyClient extends TorrentClient<SynologyTorrent> {
    public name = 'Synology Download Station'
    public id = 'downloadstation'
    torrents(): Promise<TorrentUpdates> {
        return getSnapshot().then((data) => this.processData(data))
    }

    processData(data: Record<string, any>) {
        return {
            dirty: true,
            labels: [],
            all: data.tasks.map((task: Record<string, any>) => this.build(task)),
            changed: [],
            deleted: []
        };
    }

    build(data: Record<string, any>) {
        return new SynologyTorrent(data)
    }

    defaultPath(): string {
        return "/webapi";
    }

    addTorrentUrl(magnet: string, options?: TorrentUploadOptions): Promise<void> {
        return addTorrentUrl(magnet, options)
    }

    uploadTorrent(buffer: Uint8Array, filename?: string, options?: TorrentUploadOptions, sourcePath?: string): Promise<void> {
        return uploadTorrent(buffer, filename || "upload.torrent", options, sourcePath)
    }

    start(torrents: SynologyTorrent[]): Promise<void> {
        return invokeAction("start", torrents.map((torrent) => torrent.id));
    }

    pause(torrents: SynologyTorrent[]): Promise<void> {
        return invokeAction("pause", torrents.map((torrent) => torrent.id));
    }

    remove(torrents: SynologyTorrent[]): Promise<void> {
        return invokeAction("remove", torrents.map((torrent) => torrent.id));
    }

    setLocation(torrents: SynologyTorrent[], location: string): Promise<void> {
        return invokeAction("setLocation", torrents.map((torrent) => torrent.id), location);
    }

    deleteTorrents(torrents: SynologyTorrent[]): Promise<void> {
        return this.remove(torrents)
    }

    extraColumns = []

    actionHeader: TorrentActionList<SynologyTorrent> = [
        {
            label: 'Start',
            type: 'button',
            color: 'green',
            click: this.start,
            icon: 'play'
        },
        {
            label: 'Pause',
            type: 'button',
            color: 'yellow',
            click: this.pause,
            icon: 'pause'
        }

    ]
}
