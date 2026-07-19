import { IDirective, IDirectiveFactory } from "angular";
import { torrentApp } from "@renderer/app/app.module"
import { TorrentDetailsFilesTabController } from "./torrent-details-files-tab.controller";
import html from "./torrent-details-files-tab.template.html";

export class TorrentDetailsFilesTabDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    files: "<",
    resizeMode: "<",
    resizeProfile: "<",
    canSelectFiles: "<",
    updateSelection: "&",
  };
  controller = TorrentDetailsFilesTabController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new TorrentDetailsFilesTabDirective();
  }
}

torrentApp.directive("torrentDetailsFilesTab", TorrentDetailsFilesTabDirective.getInstance())
