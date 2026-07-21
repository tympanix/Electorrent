import { IScope } from "angular"
import type { BittorrentTorrentDetailsTracker } from "@shared/ipc-contract"

interface TorrentDetailsTrackerColumn {
  id: keyof BittorrentTorrentDetailsTracker
  label: string
  sortType: "alphabetical" | "numeric"
}

export interface TorrentDetailsTrackersTabScope extends IScope {
  trackers: BittorrentTorrentDetailsTracker[]
  resizeMode: string
  resizeProfile: string
  columns: TorrentDetailsTrackerColumn[]
  sortedTrackers: BittorrentTorrentDetailsTracker[]
}

export class TorrentDetailsTrackersTabController {
  static $inject = ["$scope"]

  private sortKey: keyof BittorrentTorrentDetailsTracker = "url"
  private sortDescending = false

  constructor(public scope: TorrentDetailsTrackersTabScope) {
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
    this.scope.sortedTrackers = []
    this.scope.$watch(() => this.scope.trackers, () => this.sortTrackers())
  }

  changeSorting = (columnId: keyof BittorrentTorrentDetailsTracker, descending: boolean) => {
    this.sortKey = columnId
    this.sortDescending = descending
    this.sortTrackers()
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
