import { IDirective, IDirectiveFactory, IScope } from "angular";
import { Torrent } from "@renderer/app/bittorrent";
import { TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { AddTorrentModalController } from "./add-torrent-modal.controller";
import html from "./add-torrent-modal.template.html"

export type PendingTorrentUploadList = Array<PendingTorrentUploadItem>

export type PendingTorrentUploadItem = PendingTorrentUploadFile|PendingTorrentUploadLink

export interface PendingTorrentUploadFile {
    type: 'file',
    data: Uint8Array,
    filename: string,
    sourcePath?: string,
}

export interface PendingTorrentUploadLink {
    type: 'link'
    uri: string
}

export interface AddTorrentModalScope extends IScope {
    torrents: PendingTorrentUploadList
    uploadTorrentAction: (torrent: Uint8Array, filename: string, options: TorrentUploadOptions, sourcePath?: string) => Promise<void>
    uploadTorrentUrlAction: (uri: string, options: TorrentUploadOptions) => Promise<void>
}

export class AddTorrentModalDirective implements IDirective {

    template = html
    restrict = "E"
    scope = {
        torrents: '=',
        labels: '=',
        uploadTorrentAction: '<',
        uploadTorrentUrlAction: '<'
    }
    controller = AddTorrentModalController
    controllerAs = "ctl"

    static getInstance(): IDirectiveFactory {
        return () => new AddTorrentModalDirective()
    }
}
