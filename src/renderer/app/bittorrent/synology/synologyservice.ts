import { ContextActionList, TorrentActionList, TorrentClient, TorrentUpdates } from "@renderer/app/bittorrent/torrentclient";
import { SynologyTorrent } from "./synologytorrent";
import { addTorrentUrl, connect, getSnapshot, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";

export class SynologyClient extends TorrentClient<SynologyTorrent> {
    public name = 'Synology Download Station'
    public id = 'downloadstation'

    connect(server): Promise<void> {
        return connect(server)
    }

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

    addTorrentUrl(magnet: string): Promise<void> {
        return addTorrentUrl(magnet)
    }

    uploadTorrent(buffer: Uint8Array, filename?: string): Promise<void> {
        return uploadTorrent(buffer, filename || "upload.torrent")
    }

    start(torrents: SynologyTorrent[]): Promise<void> {
        return invokeAction("start", torrents.map((torrent) => torrent.hash));
    }

    pause(torrents: SynologyTorrent[]): Promise<void> {
        return invokeAction("pause", torrents.map((torrent) => torrent.hash));
    }

    remove(torrents: SynologyTorrent[]): Promise<void> {
        return invokeAction("remove", torrents.map((torrent) => torrent.hash));
    }

    deleteTorrents(torrents: SynologyTorrent[]): Promise<void> {
        return this.remove(torrents)
    }

    enableTrackerFilter = false

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

    contextMenu: ContextActionList<SynologyTorrent> = [
        {
            label: 'Remove Torrent',
            click: this.remove,
            icon: 'remove'
        }
    ];
}
