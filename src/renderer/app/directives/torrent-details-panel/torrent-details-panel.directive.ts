import { IDirective, IDirectiveFactory } from "angular";
import { TorrentDetailsPanelController } from "./torrent-details-panel.controller";
import html from "./torrent-details-panel.template.html";

export class TorrentDetailsPanelDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    settings: "=",
  };
  controller = TorrentDetailsPanelController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new TorrentDetailsPanelDirective();
  }
}
