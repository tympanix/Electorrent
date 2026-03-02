import { IDirective, IDirectiveFactory } from "angular";
import { TorrentFilesModalController } from "./torrent-files-modal.controller";
import html from "./torrent-files-modal.template.html";

export class TorrentFilesModalDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
  };
  controller = TorrentFilesModalController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new TorrentFilesModalDirective();
  }
}
