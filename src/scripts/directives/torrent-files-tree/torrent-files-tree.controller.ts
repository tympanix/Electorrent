import { IScope } from "angular";
import { TorrentFile } from "../../bittorrent/abstracttorrent";
import { buildTorrentFileRows, TorrentFileRow } from "./torrent-files-tree.helper";

export interface TorrentFilesTreeScope extends IScope {
  files: TorrentFile[];
  rows: TorrentFileRow[];
  visibleRows: TorrentFileRow[];
  expandedFolders: Record<string, boolean>;
  selectAll: () => void;
  selectNone: () => void;
  invertSelection: () => void;
  toggleExpanded: (path: string) => void;
  isExpanded: (path: string) => boolean;
  getFolderWanted: (row: TorrentFileRow) => boolean;
  setFolderWanted: (row: TorrentFileRow, value: boolean) => void;
  getFolderIndeterminate: (row: TorrentFileRow) => boolean;
}

export class TorrentFilesTreeController {
  static $inject = ["$scope"];

  constructor(private scope: TorrentFilesTreeScope) {
    scope.expandedFolders = {};
    scope.visibleRows = [];
    scope.selectAll = () => this.selectAll();
    scope.selectNone = () => this.selectNone();
    scope.invertSelection = () => this.invertSelection();
    scope.toggleExpanded = (path: string) => this.toggleExpanded(path);
    scope.isExpanded = (path: string) => this.isExpanded(path);
    scope.getFolderWanted = (row: TorrentFileRow) => this.getFolderWanted(row);
    scope.setFolderWanted = (row: TorrentFileRow, value: boolean) => this.setFolderWanted(row, value);
    scope.getFolderIndeterminate = (row: TorrentFileRow) => this.getFolderIndeterminate(row);
    scope.$watch(
      () => scope.files,
      (files: TorrentFile[]) => {
        scope.rows = buildTorrentFileRows(files || []);
        this.updateVisibleRows();
      },
      true
    );
    scope.$watch(
      () => scope.expandedFolders,
      () => this.updateVisibleRows(),
      true
    );
  }

  private updateVisibleRows() {
    const { rows, expandedFolders } = this.scope;
    if (!rows || !rows.length) {
      this.scope.visibleRows = [];
      return;
    }
    this.scope.visibleRows = rows.filter(
      (row) => row.depth === 0 || expandedFolders[row.parentPath!]
    );
    this.scope.visibleRows.forEach((row) => {
      if (row.isDirectory) {
        row._folderWanted = this.getFolderWanted(row);
        row._folderIndeterminate = this.getFolderIndeterminate(row);
      }
    });
  }

  private toggleExpanded(path: string) {
    this.scope.expandedFolders[path] = !this.scope.expandedFolders[path];
    this.updateVisibleRows();
  }

  private isExpanded(path: string): boolean {
    return !!this.scope.expandedFolders[path];
  }

  private getFolderWanted(row: TorrentFileRow): boolean {
    if (!row.filesInSubtree || !row.filesInSubtree.length) return false;
    return row.filesInSubtree.every((f) => f.wanted);
  }

  private setFolderWanted(row: TorrentFileRow, value: boolean) {
    (row.filesInSubtree || []).forEach((f) => (f.wanted = value));
  }

  private getFolderIndeterminate(row: TorrentFileRow): boolean {
    if (!row.filesInSubtree || !row.filesInSubtree.length) return false;
    const wanted = row.filesInSubtree.filter((f) => f.wanted).length;
    return wanted > 0 && wanted < row.filesInSubtree.length;
  }

  selectAll() {
    (this.scope.files || []).forEach((f) => (f.wanted = true));
  }

  selectNone() {
    (this.scope.files || []).forEach((f) => (f.wanted = false));
  }

  invertSelection() {
    (this.scope.files || []).forEach((f) => (f.wanted = !f.wanted));
  }
}
