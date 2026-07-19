import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import { TorrentFilesModalController } from "./torrent-files-modal.controller";
import html from "./torrent-files-modal.template.html";

export interface TorrentFilesModalScope extends angular.IScope {
  onSaved?: () => Promise<void> | void;
}

export class TorrentFilesModalDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    onSaved: "<",
  };
  controller = TorrentFilesModalController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new TorrentFilesModalDirective();
  }
}

torrentApp.directive("torrentFilesModal", TorrentFilesModalDirective.getInstance())
