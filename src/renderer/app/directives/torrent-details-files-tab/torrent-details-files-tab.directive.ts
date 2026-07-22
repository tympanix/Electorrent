import { IDirective, IDirectiveFactory } from "angular";
import { TorrentDetailsFilesTabController } from "./torrent-details-files-tab.controller";
import html from "./torrent-details-files-tab.template.html";

export class TorrentDetailsFilesTabDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    torrent: "<",
    refresh: "<",
  };
  controller = TorrentDetailsFilesTabController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new TorrentDetailsFilesTabDirective();
  }
}
