import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from "@angular/core";
import { CommonModule } from "@angular/common";
import type { BittorrentFileSelection, TorrentMetadataFile } from "@shared/ipc-contract";

export interface UploadFileTreeNode {
    id: string;
    name: string;
    path: string;
    size: number;
    level: number;
    fileIndex?: number;
    children: UploadFileTreeNode[];
    selected: boolean;
    partial: boolean;
}

@Component({
    selector: "torrent-upload-file-selection",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./torrent-upload-file-selection.template.html",
})
export class TorrentUploadFileSelectionDirective implements OnChanges {
    @Input() files?: TorrentMetadataFile[];
    @Input() onSelectionChange?: (selection?: BittorrentFileSelection[]) => void;
    @Output() readonly selectionChange = new EventEmitter<BittorrentFileSelection[] | undefined>();

    visibleFileTree: UploadFileTreeNode[] = [];
    private fileTree: UploadFileTreeNode[] = [];

    ngOnChanges(changes: SimpleChanges) {
        if (changes.files) {
            this.refreshFiles();
        }
    }

    toggleFileNode(node: UploadFileTreeNode) {
        this.setNodeSelection(node, node.partial ? true : !node.selected);
        this.emitSelection();
    }

    formatBytes(value: unknown) {
        const bytes = Number(value);
        if (!Number.isFinite(bytes) || bytes < 0) return "";
        if (bytes === 0) return "0 B";
        const unit = 1024;
        const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
        const index = Math.floor(Math.log(bytes) / Math.log(unit));
        return `${parseFloat((bytes / Math.pow(unit, index)).toFixed(1))} ${sizes[index]}`;
    }

    trackNode(_index: number, node: UploadFileTreeNode) {
        return node.id;
    }

    private refreshFiles() {
        if (!this.files?.length) {
            this.fileTree = [];
            this.visibleFileTree = [];
            this.publishSelection(undefined);
            return;
        }

        this.fileTree = this.buildFileTree(this.files);
        this.visibleFileTree = this.flattenFileTree(this.fileTree);
        this.emitSelection();
    }

    private buildFileTree(files: TorrentMetadataFile[]) {
        const roots: UploadFileTreeNode[] = [];
        const folders = new Map<string, UploadFileTreeNode>();

        files.forEach((file, index) => {
            const normalizedPath = file.path || file.name || `file-${index + 1}`;
            const parts = normalizedPath.split(/[\\/]+/).filter(Boolean);
            let siblings = roots;
            let folderPath = "";

            parts.forEach((part, partIndex) => {
                const isFile = partIndex === parts.length - 1;
                folderPath = folderPath ? `${folderPath}/${part}` : part;
                if (isFile) {
                    siblings.push({
                        id: `file-${index}`,
                        name: part,
                        path: normalizedPath,
                        size: file.length || 0,
                        level: partIndex,
                        fileIndex: index,
                        children: [],
                        selected: true,
                        partial: false,
                    });
                    return;
                }

                let folder = folders.get(folderPath);
                if (!folder) {
                    folder = {
                        id: `folder-${encodeURIComponent(folderPath)}`,
                        name: part,
                        path: folderPath,
                        size: 0,
                        level: partIndex,
                        children: [],
                        selected: true,
                        partial: false,
                    };
                    folders.set(folderPath, folder);
                    siblings.push(folder);
                }
                siblings = folder.children;
            });
        });

        this.refreshFolderState(roots);
        return roots;
    }

    private flattenFileTree(nodes: UploadFileTreeNode[]): UploadFileTreeNode[] {
        return nodes.flatMap((node) => [node, ...this.flattenFileTree(node.children)]);
    }

    private setNodeSelection(node: UploadFileTreeNode, selected: boolean) {
        node.selected = selected;
        node.partial = false;
        node.children.forEach((child) => this.setNodeSelection(child, selected));
        this.refreshFolderState(this.fileTree);
    }

    private refreshFolderState(nodes: UploadFileTreeNode[]) {
        nodes.forEach((node) => {
            if (node.children.length === 0) {
                return;
            }

            this.refreshFolderState(node.children);
            node.size = node.children.reduce((size, child) => size + child.size, 0);
            const selectedCount = node.children.filter((child) => child.selected && !child.partial).length;
            const partialCount = node.children.filter((child) => child.partial).length;
            node.selected = selectedCount === node.children.length && partialCount === 0;
            node.partial = (selectedCount > 0 || partialCount > 0) && !node.selected;
        });
    }

    private emitSelection() {
        const selection = this.visibleFileTree
            .filter((node) => node.fileIndex !== undefined)
            .map((node): BittorrentFileSelection => ({
                index: node.fileIndex!,
                path: node.path,
                name: node.name,
                size: node.size,
                wanted: node.selected,
            }));

        this.publishSelection(selection.every((file) => file.wanted) ? undefined : selection);
    }

    private publishSelection(selection?: BittorrentFileSelection[]) {
        this.onSelectionChange?.(selection);
        this.selectionChange.emit(selection);
    }
}

export { TorrentUploadFileSelectionDirective as TorrentUploadFileSelectionComponent };
