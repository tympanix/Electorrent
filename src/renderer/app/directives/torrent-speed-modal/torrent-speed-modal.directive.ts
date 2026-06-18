import { IDirective, IDirectiveFactory } from "angular";
import { TorrentSpeedModalController } from "./torrent-speed-modal.controller";
import html from "./torrent-speed-modal.template.html";

export class TorrentSpeedModalDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    modalRef: "=?",
    onSaved: "<",
  };
  controller = TorrentSpeedModalController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new TorrentSpeedModalDirective();
  }
}
