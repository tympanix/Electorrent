import { IDocumentService, IFilterService, IScope, IWindowService } from "angular";
import {
  TorrentDetailsFileColumn,
  TorrentDetailsFileItem,
  TorrentDetailsInfoField,
  TorrentDetailsPanelData,
} from "@renderer/app/bittorrent/torrentclient";
import { loadSortingState, SortingOptions } from "@renderer/app/directives/sorting/sorting.controller";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

export interface TorrentDetailsPanelScope extends IScope {
  settings: any;
  isOpen: boolean;
  loading: boolean;
  error: string | null;
  torrent: any;
  panel: TorrentDetailsPanelData;
  activeTab: "info" | "files";
  sortedFiles: TorrentDetailsFileItem[];
  resizeMode: string;
  resizeProfile: string;
}

export class TorrentDetailsPanelController {
  static $inject = ["$scope", "$rootScope", "$filter", "$window", "$document"];

  private readonly defaultPanelHeight = 320;
  private readonly minPanelHeight = 220;
  private readonly sortingOptions: SortingOptions = {
    defaultSortKey: "name",
    defaultSortOrder: false,
    sortKeyPrefix: "torrent-details-files.sort-key",
    sortOrderPrefix: "torrent-details-files.sort-desc",
  };
  private fileSortKey = "name";
  private fileSortDescending = false;
  private panelHeight = this.defaultPanelHeight;
  private loadRequestId = 0;
  private stopResizeListeners?: () => void;

  constructor(
    public scope: TorrentDetailsPanelScope,
    private rootScope: ElectorrentRootScope,
    private $filter: IFilterService,
    private $window: IWindowService,
    private $document: IDocumentService,
  ) {
    this.scope.isOpen = false;
    this.scope.loading = false;
    this.scope.error = null;
    this.scope.torrent = null;
    this.scope.activeTab = "info";
    this.scope.sortedFiles = [];
    this.scope.resizeMode = "FixedResizer";
    this.scope.resizeProfile = this.getResizeProfile();
    this.scope.panel = {
      info: { sections: [] },
      files: { columns: [], items: [] },
    };

    this.scope.$watch(
      () => this.scope.settings?.ui?.resizeMode,
      (resizeMode?: string) => {
        this.scope.resizeMode = resizeMode || "FixedResizer";
      },
    );

    const openListener = this.rootScope.$on("torrentDetails:open", (_event, torrent) => {
      this.open(torrent);
    });
    const syncListener = this.rootScope.$on("torrentDetails:sync", (_event, torrent) => {
      if (!this.scope.isOpen) {
        return;
      }

      if (!torrent) {
        this.clearSelection();
        return;
      }

      this.loadDetails(torrent);
    });
    const resetListener = this.rootScope.$on("wipe:torrents", () => {
      this.close();
    });

    this.scope.$on("$destroy", () => {
      openListener();
      syncListener();
      resetListener();
      this.stopResizeListeners?.();
    });
  }

  async open(torrent: any) {
    if (!torrent) {
      return;
    }

    this.scope.isOpen = true;
    this.panelHeight = this.defaultPanelHeight;
    this.scope.activeTab = "info";
    this.syncResizeBindings();
    await this.loadDetails(torrent);
  }

  close() {
    this.loadRequestId += 1;
    this.stopResizeListeners?.();
    this.scope.isOpen = false;
    this.scope.activeTab = "info";
    this.resetPanelState();
  }

  showTab(tab: "info" | "files") {
    this.scope.activeTab = tab;
  }

  isActiveTab(tab: "info" | "files") {
    return this.scope.activeTab === tab;
  }

  showStateMessage() {
    return !this.scope.loading && (!!this.scope.error || !this.scope.torrent);
  }

  stateMessageIcon() {
    return this.scope.error ? "warning circle" : "info circle";
  }

  stateMessageText() {
    return this.scope.error || "Select a torrent to view its details.";
  }

  panelStyle() {
    return {
      height: `${this.panelHeight}px`,
    };
  }

  private getResizeProfile() {
    const serverId = this.rootScope.$server?.id || this.rootScope.$btclient?.id || "default";
    return `torrent-details-files.${serverId}`;
  }

  startResizing(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const startY = event.clientY;
    const startHeight = this.panelHeight;
    const documentRef = this.$document[0];

    this.stopResizeListeners?.();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const maxHeight = Math.max(this.minPanelHeight, (this.$window.innerHeight || startHeight) - 140);
      const nextHeight = Math.max(this.minPanelHeight, Math.min(maxHeight, startHeight + delta));

      this.scope.$evalAsync(() => {
        this.panelHeight = nextHeight;
      });
    };

    const onMouseUp = () => {
      documentRef.removeEventListener("mousemove", onMouseMove);
      documentRef.removeEventListener("mouseup", onMouseUp);
      this.stopResizeListeners = undefined;
    };

    documentRef.addEventListener("mousemove", onMouseMove);
    documentRef.addEventListener("mouseup", onMouseUp);
    this.stopResizeListeners = onMouseUp;
  }

  changeSorting = (columnId: string, descending: boolean) => {
    this.fileSortKey = columnId;
    this.fileSortDescending = descending;
    this.sortFiles();
  };

  formatFieldValue(field: TorrentDetailsInfoField) {
    switch (field.format) {
      case "bytes":
        return this.applyFilter("bytes", field.value);
      case "speed":
        return this.applyFilter("speed", field.value);
      case "speedLimit":
        return this.applyFilter("speedLimit", field.value);
      case "ratio": {
        const value = Number(field.value);
        return Number.isFinite(value) ? value.toFixed(2) : "";
      }
      case "eta":
        return this.applyFilter("eta", field.value);
      case "epoch":
        return this.applyFilter("epoch", field.value);
      case "boolean":
        return field.value ? "Yes" : "No";
      case "number":
        return String(field.value);
      case "percent":
        return this.formatPercent(field.value);
      case "path":
      case "text":
      default:
        return field.value == null ? "" : String(field.value);
    }
  }

  formatFileCell(column: TorrentDetailsFileColumn, file: TorrentDetailsFileItem) {
    const value = file[column.id];

    switch (column.format) {
      case "bytes":
        return this.applyFilter("bytes", value);
      case "percent":
        return this.formatPercent(typeof value === "number" ? value : Number(value));
      case "number":
        return value == null ? "" : String(value);
      case "text":
      default:
        return value == null ? "" : String(value);
    }
  }

  fileProgressPercent(file: TorrentDetailsFileItem) {
    const progress = typeof file.progress === "number" ? file.progress : Number(file.progress);
    if (!Number.isFinite(progress) || progress < 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, progress * 100));
  }

  private formatPercent(value: unknown) {
    const numeric = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return "";
    }

    return `${(numeric * 100).toFixed(1)}%`;
  }

  private applyFilter(name: string, ...args: any[]) {
    const filter = this.$filter(name) as (...filterArgs: any[]) => string;
    return typeof filter === "function" ? filter(...args) : "";
  }

  private async loadDetails(torrent: any) {
    const requestId = ++this.loadRequestId;

    this.syncResizeBindings();
    this.scope.loading = true;
    this.scope.error = null;
    this.scope.torrent = torrent;

    try {
      const panel = await this.rootScope.$btclient?.getTorrentDetails(torrent);
      if (requestId !== this.loadRequestId) {
        return;
      }

      this.scope.panel = panel || this.scope.panel;
      this.loadSortingSettings();
      this.sortFiles();
    } catch (err) {
      if (requestId !== this.loadRequestId) {
        return;
      }

      this.scope.error = err && err.message ? err.message : "Failed to load torrent details";
    } finally {
      if (requestId === this.loadRequestId) {
        this.scope.loading = false;
        this.scope.$evalAsync();
      }
    }
  }

  private sortFiles() {
    const columns = this.scope.panel?.files?.columns || [];
    const items = [...(this.scope.panel?.files?.items || [])];
    const column = columns.find((entry) => entry.id === this.fileSortKey) || columns[0];
    const sortKey = column?.id || "name";
    const sortType = column?.sortType || (sortKey === "name" || sortKey === "path" ? "alphabetical" : "numeric");

    items.sort((left, right) => {
      const leftValue = left[sortKey];
      const rightValue = right[sortKey];

      if (sortType === "alphabetical") {
        return String(leftValue || "").toLowerCase().localeCompare(String(rightValue || "").toLowerCase());
      }

      return Number(leftValue || 0) - Number(rightValue || 0);
    });

    if (this.fileSortDescending) {
      items.reverse();
    }

    this.scope.sortedFiles = items;
  }

  private syncResizeBindings() {
    this.scope.resizeMode = this.scope.settings?.ui?.resizeMode || "FixedResizer";
    this.scope.resizeProfile = this.getResizeProfile();
  }

  private loadSortingSettings() {
    const columns = this.scope.panel?.files?.columns || [];
    const defaultColumn = columns[0]?.id || "name";
    const { sortKey, sortOrder } = loadSortingState(this.$window, this.scope.resizeProfile, this.sortingOptions);

    this.fileSortKey = columns.some((column) => column.id === sortKey)
      ? sortKey
      : defaultColumn;
    this.fileSortDescending = sortOrder;
  }

  private clearSelection() {
    this.loadRequestId += 1;
    this.resetPanelState();
  }

  private resetPanelState() {
    this.scope.loading = false;
    this.scope.error = null;
    this.scope.torrent = null;
    this.scope.panel = {
      info: { sections: [] },
      files: { columns: [], items: [] },
    };
    this.scope.sortedFiles = [];
  }
}
