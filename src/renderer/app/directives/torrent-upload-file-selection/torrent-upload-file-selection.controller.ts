import type { BittorrentFileSelection, TorrentMetadataFile } from "@shared/ipc-contract";
import type { TorrentUploadFileSelectionScope } from "./torrent-upload-file-selection.directive";

interface UploadFileTreeNode {
    id: string
    name: string
    path: string
    size: number
    level: number
    fileIndex?: number
    children: UploadFileTreeNode[]
    selected: boolean
    partial: boolean
}

export class TorrentUploadFileSelectionController {
    static $inject = ["$scope"]

    visibleFileTree: UploadFileTreeNode[] = []
    private fileTree: UploadFileTreeNode[] = []

    constructor(private readonly scope: TorrentUploadFileSelectionScope) {
        scope.$watch(() => scope.files, () => this.refreshFiles())
    }

    toggleFileNode(node: UploadFileTreeNode) {
        this.setNodeSelection(node, node.partial ? true : !node.selected)
        this.emitSelection()
    }

    private refreshFiles() {
        if (!this.scope.files?.length) {
            this.fileTree = []
            this.visibleFileTree = []
            this.scope.onSelectionChange({ selection: undefined })
            return
        }

        this.fileTree = this.buildFileTree(this.scope.files)
        this.visibleFileTree = this.flattenFileTree(this.fileTree)
        this.emitSelection()
    }

    private buildFileTree(files: TorrentMetadataFile[]) {
        const roots: UploadFileTreeNode[] = []
        const folders = new Map<string, UploadFileTreeNode>()

        files.forEach((file, index) => {
            const normalizedPath = file.path || file.name || `file-${index + 1}`
            const parts = normalizedPath.split(/[\\/]+/).filter(Boolean)
            let siblings = roots
            let folderPath = ""

            parts.forEach((part, partIndex) => {
                const isFile = partIndex === parts.length - 1
                folderPath = folderPath ? `${folderPath}/${part}` : part
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
                    })
                    return
                }

                let folder = folders.get(folderPath)
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
                    }
                    folders.set(folderPath, folder)
                    siblings.push(folder)
                }
                siblings = folder.children
            })
        })

        this.refreshFolderState(roots)
        return roots
    }

    private flattenFileTree(nodes: UploadFileTreeNode[]): UploadFileTreeNode[] {
        return nodes.flatMap((node) => [node, ...this.flattenFileTree(node.children)])
    }

    private setNodeSelection(node: UploadFileTreeNode, selected: boolean) {
        node.selected = selected
        node.partial = false
        node.children.forEach((child) => this.setNodeSelection(child, selected))
        this.refreshFolderState(this.fileTree)
    }

    private refreshFolderState(nodes: UploadFileTreeNode[]) {
        nodes.forEach((node) => {
            if (node.children.length === 0) {
                return
            }

            this.refreshFolderState(node.children)
            node.size = node.children.reduce((size, child) => size + child.size, 0)
            const selectedCount = node.children.filter((child) => child.selected && !child.partial).length
            const partialCount = node.children.filter((child) => child.partial).length
            node.selected = selectedCount === node.children.length && partialCount === 0
            node.partial = (selectedCount > 0 || partialCount > 0) && !node.selected
        })
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
            }))

        this.scope.onSelectionChange({
            selection: selection.every((file) => file.wanted) ? undefined : selection,
        })
    }
}
