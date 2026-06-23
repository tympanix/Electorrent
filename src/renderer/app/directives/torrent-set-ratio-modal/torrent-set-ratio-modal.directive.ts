import { IDirective, IDirectiveFactory } from "angular";
import { TorrentSetRatioModalController } from "./torrent-set-ratio-modal.controller";
import html from "./torrent-set-ratio-modal.template.html";

export class TorrentSetRatioModalDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    modalRef: "=?",
    onSaved: "<",
  };
  controller = TorrentSetRatioModalController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new TorrentSetRatioModalDirective();
  }
}
