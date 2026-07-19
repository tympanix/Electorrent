import { IDirective, IDirectiveFactory } from "angular"
import { TorrentDetailsPeersTabController } from "./torrent-details-peers-tab.controller"
import html from "./torrent-details-peers-tab.template.html"

export class TorrentDetailsPeersTabDirective implements IDirective {
  template = html
  restrict = "E"
  scope = { peers: "=" }
  controller = TorrentDetailsPeersTabController
  controllerAs = "ctl"

  static getInstance(): IDirectiveFactory {
    return () => new TorrentDetailsPeersTabDirective()
  }
}
