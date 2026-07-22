import { IDirective, IDirectiveFactory } from "angular";
import { TorrentDetailsInfoTabController } from "./torrent-details-info-tab.controller";
import html from "./torrent-details-info-tab.template.html";

export class TorrentDetailsInfoTabDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    torrent: "<",
    refresh: "<",
  };
  controller = TorrentDetailsInfoTabController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new TorrentDetailsInfoTabDirective();
  }
}
