import { IScope } from "angular"
import type { SettingsService } from "@renderer/app/services/settings"
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope"
import type { BittorrentTorrentDetailsTracker } from "@shared/ipc-contract"

interface TorrentDetailsTrackerColumn {
  id: keyof BittorrentTorrentDetailsTracker
  label: string
  sortType: "alphabetical" | "numeric"
}

export interface TorrentDetailsTrackersTabScope extends IScope {
  torrent: any
  refresh: number
  trackers: BittorrentTorrentDetailsTracker[]
  resizeMode: string
  resizeProfile: string
  columns: TorrentDetailsTrackerColumn[]
  sortedTrackers: BittorrentTorrentDetailsTracker[]
  loading: boolean
  loaded: boolean
  error: string | null
}

export class TorrentDetailsTrackersTabController {
  static $inject = ["$scope", "$rootScope", "settingsService"]

  private sortKey: keyof BittorrentTorrentDetailsTracker = "url"
  private sortDescending = false
  private requestId = 0
  private torrentId?: string

  constructor(
    public scope: TorrentDetailsTrackersTabScope,
    private rootScope: ElectorrentRootScope,
    private settingsService: SettingsService,
  ) {
    this.scope.columns = [
      { id: "url", label: "URL", sortType: "alphabetical" },
      { id: "status", label: "Status", sortType: "alphabetical" },
      { id: "tier", label: "Tier", sortType: "numeric" },
      { id: "peers", label: "Peers", sortType: "numeric" },
      { id: "seeds", label: "Seeds", sortType: "numeric" },
      { id: "leeches", label: "Leeches", sortType: "numeric" },
      { id: "downloaded", label: "Downloaded", sortType: "numeric" },
      { id: "lastAnnounce", label: "Last announce", sortType: "numeric" },
      { id: "nextAnnounce", label: "Next announce", sortType: "numeric" },
      { id: "message", label: "Message", sortType: "alphabetical" },
    ]
    this.scope.trackers = []
    this.scope.sortedTrackers = []
    this.scope.loading = false
    this.scope.loaded = false
    this.scope.error = null
    this.configureResize()
    this.scope.$watch(() => this.scope.trackers, () => this.sortTrackers())
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

  changeSorting = (columnId: keyof BittorrentTorrentDetailsTracker, descending: boolean) => {
    this.sortKey = columnId
    this.sortDescending = descending
    this.sortTrackers()
  }

  private async load() {
    const torrent = this.scope.torrent
    if (!torrent) {
      return
    }

    if (this.torrentId !== torrent.id) {
      this.torrentId = torrent.id
      this.scope.trackers = []
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
      const data = await client.getTorrentDetailsTrackers(torrent)
      if (requestId !== this.requestId || this.scope.torrent !== torrent) {
        return
      }
      this.scope.trackers = data?.items || []
      this.scope.loaded = true
    } catch (err) {
      if (requestId === this.requestId && this.scope.torrent === torrent && !this.scope.loaded) {
        this.scope.error = err && err.message ? err.message : "Failed to load torrent trackers"
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
    this.scope.resizeProfile = `torrent-details-trackers.${serverId}`
  }

  private sortTrackers() {
    const column = this.scope.columns.find(({ id }) => id === this.sortKey) || this.scope.columns[0]
    this.scope.sortedTrackers = [...(this.scope.trackers || [])].sort((left, right) => {
      const leftValue = left[column.id]
      const rightValue = right[column.id]
      const compared = column.sortType === "numeric"
        ? Number(leftValue ?? 0) - Number(rightValue ?? 0)
        : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, { sensitivity: "base" })
      return this.sortDescending ? -compared : compared
    })
  }
}
