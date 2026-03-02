import { IDirective, IDirectiveFactory } from "angular";
import { TorrentFilesTreeController } from "./torrent-files-tree.controller";
import html from "./torrent-files-tree.template.html";

export class TorrentFilesTreeDirective implements IDirective {
  template = html;
  restrict = "E";
  scope = {
    files: "=",
  };
  controller = TorrentFilesTreeController;
  controllerAs = "ctl";

  static getInstance(): IDirectiveFactory {
    return () => new TorrentFilesTreeDirective();
  }
}
