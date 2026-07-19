import { IDirective, IDirectiveFactory, IScope } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import type { BittorrentFileSelection, TorrentMetadataFile } from "@shared/ipc-contract";
import { TorrentUploadFileSelectionController } from "./torrent-upload-file-selection.controller";
import html from "./torrent-upload-file-selection.template.html";

export interface TorrentUploadFileSelectionScope extends IScope {
    files?: TorrentMetadataFile[]
    onSelectionChange: (locals: { selection?: BittorrentFileSelection[] }) => void
}

export class TorrentUploadFileSelectionDirective implements IDirective {
    template = html
    restrict = "E"
    scope = {
        files: "<",
        onSelectionChange: "&",
    }
    controller = TorrentUploadFileSelectionController
    controllerAs = "ctl"

    static getInstance(): IDirectiveFactory {
        return () => new TorrentUploadFileSelectionDirective()
    }
}

torrentApp.directive("torrentUploadFileSelection", TorrentUploadFileSelectionDirective.getInstance())
