import { ContextActionList, TorrentActionList, TorrentClient, TorrentUpdates, TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { DelugeTorrent } from "./torrentd";
import { addTorrentUrl, connect, getSnapshot, invokeAction, uploadTorrent } from "@renderer/app/bittorrent/ipc";

export class DelugeClient extends TorrentClient<DelugeTorrent> {
    public name = 'Deluge'
    public id = 'deluge'

    connect(server): Promise<void> {
        return connect(server)
    }

    async torrents(): Promise<TorrentUpdates> {
        const data: Record<string, any> = await getSnapshot()

        return {
            labels: [],
            all: Object.keys(data.torrents || {}).map((hash) => new DelugeTorrent(hash, data.torrents[hash])),
            changed: [],
            deleted: [],
            dirty: true,
        }
    }

    defaultPath(): string {
      return "/"
    }

    addTorrentUrl(magnet: string, options?: TorrentUploadOptions): Promise<void> {
        return addTorrentUrl(magnet, options)
    }

    uploadTorrent(buffer: Uint8Array, filename: string, options?: TorrentUploadOptions): Promise<void> {
        return uploadTorrent(buffer, filename, options)
    }

    resume(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("resume", torrents.map((torrent) => torrent.hash))
    }

    pause(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("pause", torrents.map((torrent) => torrent.hash))
    }

    verify(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("verify", torrents.map((torrent) => torrent.hash))
    }

    remove(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("remove", torrents.map((torrent) => torrent.hash))
    }

    removeAndDelete(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("removeAndDelete", torrents.map((torrent) => torrent.hash))
    }

    queueUp(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueUp", torrents.map((torrent) => torrent.hash))
    }

    queueDown(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueDown", torrents.map((torrent) => torrent.hash))
    }

    queueTop(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueTop", torrents.map((torrent) => torrent.hash))
    }

    queueBottom(torrents: DelugeTorrent[]): Promise<void> {
        return invokeAction("queueBottom", torrents.map((torrent) => torrent.hash))
    }

    deleteTorrents(torrents: DelugeTorrent[]): Promise<void> {
        return this.remove(torrents)
    }

    enableTrackerFilter = false

    extraColumns = []

    actionHeader: TorrentActionList<DelugeTorrent> = [
        {
            label: 'Start',
            type: 'button',
            color: 'green',
            click: this.resume,
            icon: 'play',
            role: 'resume'
        },
        {
            label: 'Pause',
            type: 'button',
            color: 'red',
            click: this.pause,
            icon: 'pause',
            role: 'stop'
        },
    ]

    contextMenu: ContextActionList<DelugeTorrent> = [
        {
            label: 'Verify',
            click: this.verify,
            icon: 'checkmark'
        },
        {
            label: 'Move Queue Up',
            click: this.queueUp,
            icon: 'arrow up'
        },
        {
            label: 'Move Queue Down',
            click: this.queueDown,
            icon: 'arrow down'
        },
        {
            label: 'Queue Top',
            click: this.queueTop,
            icon: 'chevron circle up'
        },
        {
            label: 'Queue Bottom',
            click: this.queueBottom,
            icon: 'chevron circle down'
        },
        {
            label: 'Remove',
            click: this.remove,
            icon: 'remove'
        },
        {
            label: 'Remove and delete',
            click: this.removeAndDelete,
            icon: 'trash',
            role: 'delete'
        },
    ];
}
