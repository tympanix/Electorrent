import { CommonModule } from "@angular/common";
import { Component, DoCheck, EventEmitter, Input, OnChanges, Output } from "@angular/core";
import type { TorrentFile } from "@renderer/app/bittorrent/abstracttorrent";
import { IndeterminateValueDirective } from "./indeterminate-value.directive";
import { buildTorrentFileRows, type TorrentFileRow } from "./torrent-files-tree.helper";

@Component({
    selector: "torrent-files-tree",
    standalone: true,
    imports: [CommonModule, IndeterminateValueDirective],
    templateUrl: "./torrent-files-tree.template.html",
})
export class TorrentFilesTreeDirective implements DoCheck, OnChanges {
    @Input()
    set files(files: TorrentFile[] | null | undefined) {
        this.fileItems = files || [];
    }
    get files(): TorrentFile[] {
        return this.fileItems;
    }
    @Output() filesChange = new EventEmitter<TorrentFile[]>();

    rows: TorrentFileRow[] = [];
    visibleRows: TorrentFileRow[] = [];
    readonly expandedFolders: Record<string, boolean> = {};

    private fileItems: TorrentFile[] = [];
    private fileStructureSignature = "";

    ngOnChanges(): void {
        this.rebuildRows();
    }

    ngDoCheck(): void {
        const signature = this.getFileStructureSignature();
        if (signature !== this.fileStructureSignature) {
            this.rebuildRows(signature);
        }
    }

    selectAll(): void {
        this.files.forEach((file) => {
            file.wanted = true;
        });
        this.emitFilesChanged();
    }

    selectNone(): void {
        this.files.forEach((file) => {
            file.wanted = false;
        });
        this.emitFilesChanged();
    }

    invertSelection(): void {
        this.files.forEach((file) => {
            file.wanted = !file.wanted;
        });
        this.emitFilesChanged();
    }

    toggleExpanded(path: string): void {
        this.expandedFolders[path] = !this.expandedFolders[path];
        this.updateVisibleRows();
    }

    isExpanded(path: string): boolean {
        return !!this.expandedFolders[path];
    }

    getFolderWanted(row: TorrentFileRow): boolean {
        return row.filesInSubtree.length > 0
            && row.filesInSubtree.every((file) => file.wanted);
    }

    setFolderWanted(row: TorrentFileRow, wanted: boolean): void {
        row.filesInSubtree.forEach((file) => {
            file.wanted = wanted;
        });
        this.emitFilesChanged();
    }

    getFolderIndeterminate(row: TorrentFileRow): boolean {
        if (!row.filesInSubtree.length) {
            return false;
        }

        const wantedFiles = row.filesInSubtree.filter((file) => file.wanted).length;
        return wantedFiles > 0 && wantedFiles < row.filesInSubtree.length;
    }

    setFileWanted(file: TorrentFile, wanted: boolean): void {
        file.wanted = wanted;
        this.emitFilesChanged();
    }

    formatBytes(value: number, fractionSize = 1): string {
        const bytes = Number(value);
        if (!Number.isFinite(bytes) || bytes < 0) {
            return "";
        }
        if (bytes === 0) {
            return "0 B";
        }

        const decimals = Math.max(0, fractionSize);
        const unit = 1024;
        const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        const unitIndex = Math.floor(Math.log(bytes) / Math.log(unit));
        const formatted = parseFloat((bytes / Math.pow(unit, unitIndex)).toFixed(decimals));
        return `${formatted} ${units[unitIndex]}`;
    }

    private rebuildRows(signature = this.getFileStructureSignature()): void {
        this.fileStructureSignature = signature;
        this.rows = buildTorrentFileRows(this.files || []);
        this.rows.forEach((row) => {
            if (row.isDirectory && !(row.path in this.expandedFolders)) {
                this.expandedFolders[row.path] = true;
            }
        });
        this.updateVisibleRows();
    }

    private updateVisibleRows(): void {
        if (!this.rows.length) {
            this.visibleRows = [];
            return;
        }

        const parentByPath = new Map(this.rows.map((row) => [row.path, row.parentPath]));
        this.visibleRows = this.rows.filter((row) => {
            let parentPath = row.parentPath;
            while (parentPath) {
                if (!this.expandedFolders[parentPath]) {
                    return false;
                }
                parentPath = parentByPath.get(parentPath) || null;
            }
            return true;
        });
    }

    private getFileStructureSignature(): string {
        return this.files.map((file) => [
            file.index,
            file.path,
            file.name,
            file.size,
        ].join("\u0000")).join("\u0001");
    }

    private emitFilesChanged(): void {
        this.filesChange.emit(this.files);
    }
}
