import { IScope } from "angular"
import type { SettingsService } from "@renderer/app/services/settings"
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope"
import type { BittorrentTorrentPeer } from "@shared/ipc-contract"

export interface TorrentDetailsPeersTabScope extends IScope {
  torrent: any
  refresh: number
  peers: { items: BittorrentTorrentPeer[] }
  resizeMode: string
  resizeProfile: string
  columns: TorrentDetailsPeerColumn[]
  sortedPeers: BittorrentTorrentPeer[]
  loading: boolean
  loaded: boolean
  error: string | null
}

interface TorrentDetailsPeerColumn {
  id: keyof BittorrentTorrentPeer | "country"
  label: string
  sortType: "alphabetical" | "numeric"
}

export class TorrentDetailsPeersTabController {
  static $inject = ["$scope", "$rootScope", "settingsService"]

  private requestId = 0
  private torrentHash?: string

  constructor(
    public scope: TorrentDetailsPeersTabScope,
    private rootScope: ElectorrentRootScope,
    private settingsService: SettingsService,
  ) {
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
    this.scope.peers = { items: [] }
    this.scope.sortedPeers = []
    this.scope.loading = false
    this.scope.loaded = false
    this.scope.error = null
    this.configureResize()
    this.scope.$watch(() => this.scope.peers, () => this.sortPeers())
    this.scope.$watchGroup(
      [() => this.scope.torrent, () => this.scope.refresh],
      () => { void this.load() },
    )
    this.scope.$watchGroup(
      [
        () => this.settingsService.getAllSettings().ui.resizeMode,
        () => this.rootScope.$server?.id || this.rootScope.$btclient?.id,
      ],
      () => this.configureResize(),
    )
    this.scope.$on("$destroy", () => { this.requestId += 1 })
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

  private async load() {
    const torrent = this.scope.torrent
    if (!torrent) {
      return
    }

    if (this.torrentHash !== torrent.hash) {
      this.torrentHash = torrent.hash
      this.scope.peers = { items: [] }
      this.scope.loaded = false
    }

    const requestId = ++this.requestId
    this.scope.loading = true
    this.scope.error = null

    try {
      const client = this.rootScope.$btclient
      if (!client) {
        throw new Error("No torrent client is connected")
      }
      const data = await client.getTorrentDetailsPeers(torrent)
      if (requestId !== this.requestId || this.scope.torrent !== torrent) {
        return
      }
      this.scope.peers = data || { items: [] }
      this.scope.loaded = true
    } catch (err) {
      if (requestId === this.requestId && this.scope.torrent === torrent && !this.scope.loaded) {
        this.scope.error = err && err.message ? err.message : "Failed to load torrent peers"
      }
    } finally {
      if (requestId === this.requestId && this.scope.torrent === torrent) {
        this.scope.loading = false
        this.scope.$evalAsync()
      }
    }
  }

  private configureResize() {
    const serverId = this.rootScope.$server?.id || this.rootScope.$btclient?.id || "default"
    this.scope.resizeMode = this.settingsService.getAllSettings().ui.resizeMode || "OverflowResizer"
    this.scope.resizeProfile = `torrent-details-peers.${serverId}`
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
