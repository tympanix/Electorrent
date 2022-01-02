import { IDirective, IDirectiveFactory, IScope } from "angular";
import { Torrent } from "../../bittorrent";
import { TorrentUploadOptions } from "../../bittorrent/torrentclient";
import { AddTorrentModalController } from "./add-torrent-modal.controller";
import html from "./add-torrent-modal.template.html"

export interface AddTorrentModalScope extends IScope {
    torrents: Array<{data: Uint8Array, filename: string}>
    uploadTorrentAction: (torrent: Uint8Array, filename: string, options: TorrentUploadOptions) => Promise<void>
}

export class AddTorrentModalDirective implements IDirective {

    template = html
    restrict = "E"
    scope = {
        torrents: '=',
        uploadTorrentAction: '<'
    }
    controller = AddTorrentModalController
    controllerAs = "ctl"

    static getInstance(): IDirectiveFactory {
        return () => new AddTorrentModalDirective()
    }
}