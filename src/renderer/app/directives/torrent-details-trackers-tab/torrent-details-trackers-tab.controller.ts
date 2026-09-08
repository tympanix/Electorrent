import { IScope } from "angular"
import type { SortChange } from "@renderer/app/directives/sorting/sorting.controller"
import { DEFAULT_TABLE_RESIZE_OPTIONS, type TableResizeOptions } from "@renderer/app/lib/table-resize-options"
import type { SettingsService } from "@renderer/app/services/settings"
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope"
import type { BittorrentTorrentDetailsTracker } from "@shared/ipc-contract"
import type { ModalController } from "@renderer/app/directives/modal/modal.controller"

interface TorrentDetailsTrackerColumn {
  id: keyof BittorrentTorrentDetailsTracker | "actions"
  label: string
  sortType: "alphabetical" | "numeric"
}

export interface TorrentDetailsTrackersTabScope extends IScope {
  torrent: any
  refresh: number
  trackers: BittorrentTorrentDetailsTracker[]
  resizeMode: string
  resizeProfile: string
  tableResizeOptions: Readonly<TableResizeOptions>
  columns: TorrentDetailsTrackerColumn[]
  sortedTrackers: BittorrentTorrentDetailsTracker[]
  loading: boolean
  loaded: boolean
  error: string | null
  mutationError: string | null
  trackerUrl: string
  trackerModalTitle: string
  trackerModalAction: string
  trackerModalRef?: ModalController
  removeModalRef?: ModalController
}

export class TorrentDetailsTrackersTabController {
  static $inject = ["$scope", "$rootScope", "settingsService"]

  private sortKey: keyof BittorrentTorrentDetailsTracker = "url"
  private sortDescending = false
  private requestId = 0
  private torrentId?: string
  private trackerToEdit?: BittorrentTorrentDetailsTracker
  private trackerToRemove?: BittorrentTorrentDetailsTracker

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
    this.scope.mutationError = null
    this.scope.trackerUrl = ""
    this.scope.tableResizeOptions = DEFAULT_TABLE_RESIZE_OPTIONS
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
    const addTrackerListener = this.scope.$on("torrentDetailsTrackers:add", () => this.openAddTracker())
    this.scope.$on("$destroy", () => {
      this.requestId += 1
      addTrackerListener()
    })
  }

  changeSorting = ({ sortKey, descending }: SortChange<keyof BittorrentTorrentDetailsTracker>) => {
    this.sortKey = sortKey
    this.sortDescending = descending
    this.sortTrackers()
  }

  canManageTrackers() {
    return !!this.rootScope.$btclient?.features.torrentTrackerManagement
  }

  canManageTracker(tracker: BittorrentTorrentDetailsTracker) {
    return this.canManageTrackers() && /^(?:https?|udp|wss?):\/\//i.test(tracker.url)
  }

  openAddTracker() {
    this.trackerToEdit = undefined
    this.scope.trackerModalTitle = "Add Tracker"
    this.scope.trackerModalAction = "Add"
    this.scope.trackerUrl = ""
    this.scope.mutationError = null
    this.scope.trackerModalRef?.showModal()
  }

  openEditTracker(tracker: BittorrentTorrentDetailsTracker) {
    this.trackerToEdit = tracker
    this.scope.trackerModalTitle = "Edit Tracker"
    this.scope.trackerModalAction = "Save"
    this.scope.trackerUrl = tracker.url
    this.scope.mutationError = null
    this.scope.trackerModalRef?.showModal()
  }

  openRemoveTracker(tracker: BittorrentTorrentDetailsTracker) {
    this.trackerToRemove = tracker
    this.scope.mutationError = null
    this.scope.removeModalRef?.showModal()
  }

  removeTrackerUrl() {
    return this.trackerToRemove?.url || ""
  }

  closeTrackerModal() {
    this.scope.trackerModalRef?.hideModal()
  }

  closeRemoveModal() {
    this.scope.removeModalRef?.hideModal()
  }

  async saveTracker() {
    const torrent = this.scope.torrent
    const client = this.rootScope.$btclient
    const url = this.scope.trackerUrl?.trim()
    if (!torrent || !client || !url) return
    try {
      this.scope.loading = true
      this.scope.mutationError = null
      if (this.trackerToEdit) await client.editTorrentTracker(torrent, this.trackerToEdit.url, url)
      else await client.addTorrentTracker(torrent, url)
      this.closeTrackerModal()
      await this.load()
    } catch (err: any) {
      this.scope.mutationError = err?.message || "Failed to save tracker"
    } finally {
      this.scope.loading = false
      this.scope.$evalAsync()
    }
  }

  async removeTracker() {
    const torrent = this.scope.torrent
    const client = this.rootScope.$btclient
    const tracker = this.trackerToRemove
    if (!torrent || !client || !tracker) return
    try {
      this.scope.loading = true
      this.scope.mutationError = null
      await client.removeTorrentTracker(torrent, tracker.url)
      this.closeRemoveModal()
      await this.load()
    } catch (err: any) {
      this.scope.mutationError = err?.message || "Failed to remove tracker"
    } finally {
      this.scope.loading = false
      this.scope.$evalAsync()
    }
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
      const leftValue = column.id === "actions" ? "" : left[column.id]
      const rightValue = column.id === "actions" ? "" : right[column.id]
      const compared = column.sortType === "numeric"
        ? Number(leftValue ?? 0) - Number(rightValue ?? 0)
        : String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, { sensitivity: "base" })
      return this.sortDescending ? -compared : compared
    })
  }
}
