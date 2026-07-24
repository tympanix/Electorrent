import { IFilterService, IScope, IWindowService } from "angular";
import {
  TorrentDetailsFileColumn,
  TorrentDetailsFileItem,
  TorrentDetailsPanelData,
} from "@renderer/app/bittorrent/torrentclient";
import { loadSortingState, SortingOptions } from "@renderer/app/directives/sorting/sorting.controller";
import type { SettingsService } from "@renderer/app/services/settings";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";

type TorrentDetailsFiles = TorrentDetailsPanelData["files"];

interface TorrentDetailsFileRow {
  key: string;
  depth: number;
  isDirectory: boolean;
  file?: TorrentDetailsFileItem;
  filesInSubtree: TorrentDetailsFileItem[];
  data: TorrentDetailsFileItem;
}

interface TorrentDetailsFileNode {
  name: string;
  path: string;
  children: Map<string, TorrentDetailsFileNode>;
  file?: TorrentDetailsFileItem;
  filesInSubtree: TorrentDetailsFileItem[];
  data: TorrentDetailsFileItem;
}

export interface TorrentDetailsFilesTabScope extends IScope {
  torrent: any;
  refresh: number;
  files: TorrentDetailsFiles;
  resizeMode: string;
  resizeProfile: string;
  sortedFiles: TorrentDetailsFileRow[];
  loading: boolean;
  loaded: boolean;
  error: string | null;
  selectionUpdating: boolean;
  selectionError: string | null;
}

export class TorrentDetailsFilesTabController {
  static $inject = ["$scope", "$rootScope", "$filter", "$window", "settingsService"];

  private readonly sortingOptions: SortingOptions = {
    defaultSortKey: "name",
    defaultSortOrder: false,
    sortKeyPrefix: "torrent-details-files.sort-key",
    sortOrderPrefix: "torrent-details-files.sort-desc",
  };
  private fileSortKey = "name";
  private fileSortDescending = false;
  private readonly collapsedFolders = new Set<string>();
  private requestId = 0;
  private torrentId?: string;

  constructor(
    public scope: TorrentDetailsFilesTabScope,
    private rootScope: ElectorrentRootScope,
    private $filter: IFilterService,
    private $window: IWindowService,
    private settingsService: SettingsService,
  ) {
    this.scope.files = { columns: [], items: [] };
    this.scope.sortedFiles = [];
    this.scope.loading = false;
    this.scope.loaded = false;
    this.scope.error = null;
    this.scope.selectionUpdating = false;
    this.scope.selectionError = null;
    this.configureResize();
    this.scope.$watch(
      () => this.scope.files,
      (files) => {
        files?.items.forEach((file) => {
          file.wanted = file.wanted !== false;
        });
        this.scope.selectionError = null;
        this.loadSortingSettings();
        this.sortFiles();
      },
    );
    this.scope.$watchGroup(
      [() => this.scope.torrent, () => this.scope.refresh],
      () => { void this.load(); },
    );
    this.scope.$watchGroup(
      [
        () => this.settingsService.getAllSettings().ui.resizeMode,
        () => this.rootScope.$server?.id || this.rootScope.$btclient?.id,
      ],
      () => this.configureResize(),
    );
    this.scope.$on("$destroy", () => { this.requestId += 1; });
  }

  canSelectFiles() {
    return !!this.rootScope.$btclient?.features.fileSelection;
  }

  changeSorting = (columnId: string, descending: boolean) => {
    this.fileSortKey = columnId;
    this.fileSortDescending = descending;
    this.sortFiles();
  };

  isFolderExpanded(row: TorrentDetailsFileRow) {
    return row.isDirectory && !this.collapsedFolders.has(row.data.path);
  }

  toggleFolder(row: TorrentDetailsFileRow, event?: Event) {
    event?.stopPropagation();
    if (!row.isDirectory) {
      return;
    }

    if (this.collapsedFolders.has(row.data.path)) {
      this.collapsedFolders.delete(row.data.path);
    } else {
      this.collapsedFolders.add(row.data.path);
    }
    this.sortFiles();
  }

  rowWanted(row: TorrentDetailsFileRow) {
    return row.filesInSubtree.length > 0 && row.filesInSubtree.every((file) => file.wanted !== false);
  }

  rowSelectionIndeterminate(row: TorrentDetailsFileRow) {
    const wanted = row.filesInSubtree.filter((file) => file.wanted !== false).length;
    return wanted > 0 && wanted < row.filesInSubtree.length;
  }

  allFilesWanted() {
    const files = this.scope.files.items;
    return files.length > 0 && files.every((file) => file.wanted !== false);
  }

  allFilesSelectionIndeterminate() {
    const files = this.scope.files.items;
    const wanted = files.filter((file) => file.wanted !== false).length;
    return wanted > 0 && wanted < files.length;
  }

  toggleAllFiles(event: Event) {
    event.stopPropagation();
    return this.updateFileSelection(this.scope.files.items, !this.allFilesWanted());
  }

  toggleRowSelection(row: TorrentDetailsFileRow, event: Event) {
    event.stopPropagation();
    return this.updateFileSelection(row.filesInSubtree, !this.rowWanted(row));
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

  private sortFiles() {
    const columns = this.scope.files?.columns || [];
    const column = columns.find((entry) => entry.id === this.fileSortKey) || columns[0];
    const sortKey = column?.id || "name";
    const sortType = column?.sortType || (sortKey === "name" || sortKey === "path" ? "alphabetical" : "numeric");
    const root = this.buildFileTree(this.scope.files?.items || []);
    const rows: TorrentDetailsFileRow[] = [];

    const compareNodes = (left: TorrentDetailsFileNode, right: TorrentDetailsFileNode) => {
      const leftIsDirectory = left.children.size > 0 && !left.file;
      const rightIsDirectory = right.children.size > 0 && !right.file;
      if (leftIsDirectory !== rightIsDirectory) {
        return leftIsDirectory ? -1 : 1;
      }

      const leftValue = left.data[sortKey];
      const rightValue = right.data[sortKey];
      const compared = sortType === "alphabetical"
        ? String(leftValue ?? "").toLowerCase().localeCompare(String(rightValue ?? "").toLowerCase())
        : Number(leftValue ?? 0) - Number(rightValue ?? 0);
      const ordered = this.fileSortDescending ? -compared : compared;
      return ordered || left.name.localeCompare(right.name);
    };

    const visit = (node: TorrentDetailsFileNode, depth: number, visible: boolean) => {
      const isDirectory = node.children.size > 0 && !node.file;
      if (visible) {
        rows.push({
          key: isDirectory ? `folder:${node.path}` : `file:${node.file?.index}`,
          depth,
          isDirectory,
          file: node.file,
          filesInSubtree: node.filesInSubtree,
          data: node.data,
        });
      }

      const childrenVisible = visible && (!isDirectory || !this.collapsedFolders.has(node.path));
      Array.from(node.children.values()).sort(compareNodes).forEach((child) => visit(child, depth + 1, childrenVisible));
    };

    Array.from(root.children.values()).sort(compareNodes).forEach((node) => visit(node, 0, true));
    this.scope.sortedFiles = rows;
  }

  private buildFileTree(files: TorrentDetailsFileItem[]) {
    const emptyData = (name = "", path = ""): TorrentDetailsFileItem => ({
      index: -1,
      name,
      path,
      size: 0,
      progress: 0,
      wanted: false,
    });
    const root: TorrentDetailsFileNode = {
      name: "",
      path: "",
      children: new Map(),
      filesInSubtree: [],
      data: emptyData(),
    };

    files.forEach((file) => {
      const normalizedPath = (file.path || file.name || "").replace(/\\/g, "/");
      const parts = normalizedPath.split("/").filter(Boolean);
      if (!parts.length) {
        return;
      }

      let node = root;
      let currentPath = "";
      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        let child = node.children.get(part);
        if (!child) {
          child = {
            name: part,
            path: currentPath,
            children: new Map(),
            filesInSubtree: [],
            data: emptyData(part, currentPath),
          };
          node.children.set(part, child);
        }
        if (index === parts.length - 1) {
          child.file = file;
          child.data = file;
        }
        node = child;
      });
    });

    const aggregate = (node: TorrentDetailsFileNode): TorrentDetailsFileItem[] => {
      if (node.file) {
        node.filesInSubtree = [node.file];
        return node.filesInSubtree;
      }

      node.filesInSubtree = Array.from(node.children.values()).flatMap(aggregate);
      const totalSize = node.filesInSubtree.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
      const weightedValue = (key: "progress" | "availability") => {
        const values = node.filesInSubtree.filter((file) => Number.isFinite(Number(file[key])));
        if (!values.length) {
          return undefined;
        }
        if (totalSize > 0) {
          return values.reduce((sum, file) => sum + Number(file[key]) * (Number(file.size) || 0), 0) / totalSize;
        }
        return values.reduce((sum, file) => sum + Number(file[key]), 0) / values.length;
      };
      const priorities = new Set(node.filesInSubtree.map((file) => file.priority).filter((value) => value != null));
      node.data = {
        ...node.data,
        size: totalSize,
        progress: weightedValue("progress") || 0,
        availability: weightedValue("availability"),
        wanted: node.filesInSubtree.every((file) => file.wanted !== false),
        priority: priorities.size === 1 ? priorities.values().next().value : undefined,
      };
      return node.filesInSubtree;
    };

    aggregate(root);
    return root;
  }

  private async updateFileSelection(files: TorrentDetailsFileItem[], wanted: boolean) {
    const client = this.rootScope.$btclient;
    const torrent = this.scope.torrent;
    if (!this.canSelectFiles() || !client || !torrent || this.scope.selectionUpdating || !files.length) {
      return;
    }

    const previous = files.map((file) => ({ file, wanted: file.wanted }));
    files.forEach((file) => { file.wanted = wanted; });
    this.scope.selectionUpdating = true;
    this.scope.selectionError = null;
    this.sortFiles();

    try {
      await client.setTorrentFileSelection(torrent, files.map((file) => ({ ...file, wanted })));
      if (this.scope.torrent === torrent) {
        await this.load();
      }
    } catch (err) {
      previous.forEach((entry) => { entry.file.wanted = entry.wanted; });
      this.scope.selectionError = err && err.message ? err.message : "Failed to update file selection";
      this.sortFiles();
    } finally {
      this.scope.selectionUpdating = false;
      this.scope.$evalAsync();
    }
  }

  private async load() {
    const torrent = this.scope.torrent;
    if (!torrent) {
      return;
    }

    if (this.torrentId !== torrent.id) {
      this.torrentId = torrent.id;
      this.scope.files = { columns: [], items: [] };
      this.scope.loaded = false;
      this.collapsedFolders.clear();
    }

    const requestId = ++this.requestId;
    this.scope.loading = true;
    this.scope.error = null;

    try {
      const client = this.rootScope.$btclient;
      if (!client) {
        throw new Error("No torrent client is connected");
      }
      const data = await client.getTorrentDetailsFiles(torrent);
      if (requestId !== this.requestId || this.scope.torrent !== torrent) {
        return;
      }
      this.scope.files = data || { columns: [], items: [] };
      this.scope.loaded = true;
    } catch (err) {
      if (requestId === this.requestId && this.scope.torrent === torrent && !this.scope.loaded) {
        this.scope.error = err && err.message ? err.message : "Failed to load torrent files";
      }
    } finally {
      if (requestId === this.requestId && this.scope.torrent === torrent) {
        this.scope.loading = false;
        this.scope.$evalAsync();
      }
    }
  }

  private configureResize() {
    const serverId = this.rootScope.$server?.id || this.rootScope.$btclient?.id || "default";
    this.scope.resizeMode = this.settingsService.getAllSettings().ui.resizeMode || "OverflowResizer";
    this.scope.resizeProfile = `torrent-details-files.${serverId}`;
  }

  private loadSortingSettings() {
    const columns = this.scope.files?.columns || [];
    const defaultColumn = columns[0]?.id || "name";
    const { sortKey, sortOrder } = loadSortingState(this.$window, this.scope.resizeProfile, this.sortingOptions);

    this.fileSortKey = columns.some((column) => column.id === sortKey)
      ? sortKey
      : defaultColumn;
    this.fileSortDescending = sortOrder;
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
}
