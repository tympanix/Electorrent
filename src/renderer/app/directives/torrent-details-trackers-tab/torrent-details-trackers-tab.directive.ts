import { IDirective, IDirectiveFactory } from "angular";
import { TorrentDetailsTrackersTabController } from "./torrent-details-trackers-tab.controller";
import html from "./torrent-details-trackers-tab.template.html";

export class TorrentDetailsTrackersTabDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    trackers: "<",
    resizeMode: "<",
    resizeProfile: "<",
  };
  controller = TorrentDetailsTrackersTabController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new TorrentDetailsTrackersTabDirective();
  }
}
