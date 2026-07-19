import { IScope } from "angular"
import type { BittorrentTorrentPeer } from "@shared/ipc-contract"

export interface TorrentDetailsPeersTabScope extends IScope {
  peers: { items: BittorrentTorrentPeer[] }
}

export class TorrentDetailsPeersTabController {
  static $inject = ["$scope"]

  constructor(public scope: TorrentDetailsPeersTabScope) {}

  countryFlagClass(peer: BittorrentTorrentPeer) {
    return peer.countryCode ? `${peer.countryCode.toLowerCase()} flag` : ""
  }

  progressPercent(peer: BittorrentTorrentPeer) {
    return Math.max(0, Math.min(100, (Number(peer.progress) || 0) * 100))
  }
}
