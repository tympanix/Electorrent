import type { SortChange } from "@renderer/app/directives/sorting/sorting.controller"
import type { BittorrentTorrentPeer } from "@shared/ipc-contract"

export interface TorrentDetailsPeersTabScope {
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

export interface TorrentDetailsPeerColumn {
  id: keyof BittorrentTorrentPeer | "country"
  label: string
  sortType: "alphabetical" | "numeric"
}

export interface TorrentDetailsPeersClient {
  id?: string
  getTorrentDetailsPeers(torrent: any): Promise<{ items: BittorrentTorrentPeer[] }>
}

export interface TorrentDetailsPeersRuntime {
  $btclient?: TorrentDetailsPeersClient
  $server?: { id?: string }
}

export interface TorrentDetailsPeersSettings {
  getAllSettings(): { ui: { resizeMode?: string } }
}

export class TorrentDetailsPeersTabController {
  private requestId = 0
  private torrentId?: string

  constructor(
    public scope: TorrentDetailsPeersTabScope,
    private rootScope: TorrentDetailsPeersRuntime,
    private settingsService: TorrentDetailsPeersSettings,
    private notifyChange: () => void = () => undefined,
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
  }

  update(torrent: any, refresh: number) {
    this.scope.torrent = torrent
    this.scope.refresh = refresh
    this.configureResize()
    void this.load()
  }

  destroy() {
    this.requestId += 1
  }

  private sortKey: TorrentDetailsPeerColumn["id"] = "ip"
  private sortDescending = false

  changeSorting = ({ sortKey, descending }: SortChange) => {
    this.sortKey = sortKey as TorrentDetailsPeerColumn["id"]
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

  formatBytes(value: unknown) {
    if (value === null || value === undefined) return ""
    const bytes = Number(value)
    if (!Number.isFinite(bytes) || bytes < 0) return ""
    if (bytes === 0) return "0 B"
    const unit = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    const index = Math.floor(Math.log(bytes) / Math.log(unit))
    return `${parseFloat((bytes / Math.pow(unit, index)).toFixed(1))} ${sizes[index]}`
  }

  formatSpeed(value: unknown) {
    const bytes = this.formatBytes(value)
    return bytes ? `${bytes}/s` : ""
  }

  private async load() {
    const torrent = this.scope.torrent
    if (!torrent) {
      return
    }

    if (this.torrentId !== torrent.id) {
      this.torrentId = torrent.id
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
      this.sortPeers()
      this.scope.loaded = true
    } catch (err) {
      if (requestId === this.requestId && this.scope.torrent === torrent && !this.scope.loaded) {
        this.scope.error = err && err.message ? err.message : "Failed to load torrent peers"
      }
    } finally {
      if (requestId === this.requestId && this.scope.torrent === torrent) {
        this.scope.loading = false
        this.notifyChange()
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
