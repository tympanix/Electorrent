import { IScope } from "angular"
import type { BittorrentTorrentPeer } from "@shared/ipc-contract"

export interface TorrentDetailsPeersTabScope extends IScope {
  peers: { items: BittorrentTorrentPeer[] }
  resizeMode: string
  resizeProfile: string
  columns: TorrentDetailsPeerColumn[]
  sortedPeers: BittorrentTorrentPeer[]
}

interface TorrentDetailsPeerColumn {
  id: keyof BittorrentTorrentPeer | "country"
  label: string
  sortType: "alphabetical" | "numeric"
}

export class TorrentDetailsPeersTabController {
  static $inject = ["$scope"]

  constructor(public scope: TorrentDetailsPeersTabScope) {
    this.scope.columns = [
      { id: "country", label: "Country", sortType: "alphabetical" },
      { id: "ip", label: "IP", sortType: "alphabetical" },
      { id: "port", label: "Port", sortType: "numeric" },
      { id: "client", label: "Client", sortType: "alphabetical" },
      { id: "progress", label: "Progress", sortType: "numeric" },
      { id: "downloadSpeed", label: "Down Speed", sortType: "numeric" },
      { id: "uploadSpeed", label: "Up Speed", sortType: "numeric" },
      { id: "downloaded", label: "Downloaded", sortType: "numeric" },
      { id: "uploaded", label: "Uploaded", sortType: "numeric" },
      { id: "connection", label: "Connection", sortType: "alphabetical" },
      { id: "flags", label: "Flags", sortType: "alphabetical" },
    ]
    this.scope.sortedPeers = []
    this.scope.$watch(() => this.scope.peers, () => this.sortPeers())
  }

  private sortKey: TorrentDetailsPeerColumn["id"] = "ip"
  private sortDescending = false

  changeSorting = (columnId: TorrentDetailsPeerColumn["id"], descending: boolean) => {
    this.sortKey = columnId
    this.sortDescending = descending
    this.sortPeers()
  }

  countryFlag(peer: BittorrentTorrentPeer) {
    const code = peer.countryCode?.toUpperCase()
    if (!code || !/^[A-Z]{2}$/.test(code)) {
      return "🏳️"
    }
    return String.fromCodePoint(...Array.from(code).map((letter) => 0x1F1E6 + letter.charCodeAt(0) - 65))
  }

  countryName(peer: BittorrentTorrentPeer) {
    return peer.country || peer.countryCode || "Unknown"
  }

  progressPercent(peer: BittorrentTorrentPeer) {
    return Math.max(0, Math.min(100, (Number(peer.progress) || 0) * 100))
  }

  private sortPeers() {
    const column = this.scope.columns.find(({ id }) => id === this.sortKey) || this.scope.columns[1]
    const value = (peer: BittorrentTorrentPeer) => column.id === "country" ? this.countryName(peer) : peer[column.id]
    this.scope.sortedPeers = [...(this.scope.peers?.items || [])].sort((left, right) => {
      const leftValue = value(left)
      const rightValue = value(right)
      const compared = column.sortType === "numeric"
        ? Number(leftValue ?? 0) - Number(rightValue ?? 0)
        : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, { sensitivity: "base" })
      return this.sortDescending ? -compared : compared
    })
  }
}
