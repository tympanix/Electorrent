import { IDirective, IDirectiveFactory } from "angular";
import html from "./torrent-details-trackers-tab.template.html";

export class TorrentDetailsTrackersTabDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    trackers: "<",
  };

  static getInstance(): IDirectiveFactory {
    return () => new TorrentDetailsTrackersTabDirective();
  }
}
