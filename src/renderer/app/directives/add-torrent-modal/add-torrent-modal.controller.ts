import { ITimeoutService } from "angular";
import { TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import { SavedLocationModalController } from "@renderer/app/directives/saved-location-modal/saved-location-modal.controller";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import { AddTorrentModalScope } from "./add-torrent-modal.directive";
import type { BittorrentFileSelection, TorrentMetadataFile } from "@shared/ipc-contract";

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

export class AddTorrentModalController {

    static $inject = ["$scope", "$rootScope", "$timeout"]

    static defaultTorrentUploadOptions: TorrentUploadOptions = {
        startTorrent: true,
    }

    scope: AddTorrentModalScope
    rootScope: ElectorrentRootScope
    modalref: ModalController
    savedLocationModalRef: SavedLocationModalController
    uploadOptions: TorrentUploadOptions
    isLoading: boolean
    activeTab = "general"
    fileTree: UploadFileTreeNode[] = []
    visibleFileTree: UploadFileTreeNode[] = []
    private preserveUploadsOnHide: boolean
    private restoreUploadOptionsOnShow: boolean

    constructor(scope: AddTorrentModalScope, rootScope: ElectorrentRootScope, private readonly $timeout: ITimeoutService) {
        this.scope = scope
        this.rootScope = rootScope
        this.isLoading = false
        this.preserveUploadsOnHide = false
        this.restoreUploadOptionsOnShow = false
        this.uploadOptions = {}
        this.scope.$watch(() => {
            return this.scope.torrents && this.scope.torrents.length
        }, (newVal, oldVal) => {
            if (newVal > 0) {
                this.refreshUploadFiles()
                this.modalref.showModal()
            } else if (oldVal > 0 && newVal === 0) {
                this.modalref.hideModal()
            }
        })
    }

    onShow() {
        if (this.restoreUploadOptionsOnShow) {
            this.restoreUploadOptionsOnShow = false
            return
        }

        const server = this.rootScope.$server
        const configuredOptions = server?.defaultUploadOptionsEnabled
            ? server.defaultUploadOptions
            : undefined

        this.uploadOptions = Object.assign(
            {},
            AddTorrentModalController.defaultTorrentUploadOptions,
            configuredOptions || {},
        )
        this.activeTab = "general"
        this.refreshUploadFiles()
    }

    onHidden() {
        if (this.preserveUploadsOnHide) {
            return
        }
        this.scope.torrents = []
        this.fileTree = []
        this.visibleFileTree = []
    }

    supportsSavedLocations() {
        return !!this.rootScope.$btclient?.features.uploadOptions.saveLocation
    }

    getCurrentTorrentUpload() {
        if (this.scope.torrents) {
            return this.scope.torrents.length && this.scope.torrents[0]
        }
    }

    getCurrentTorrentUploadLabel() {
        const torrent = this.getCurrentTorrentUpload()
        if (!torrent) {
            return ""
        }

        return torrent.metadata?.name || (torrent.type === "file" ? torrent.filename : torrent.uri)
    }

    getCurrentTorrentUploadSize() {
        const torrent = this.getCurrentTorrentUpload()
        const metadata = torrent?.metadata
        return metadata?.length || metadata?.files.reduce((size, file) => size + (file.length || 0), 0) || 0
    }

    hasFilesTab() {
        return !!this.rootScope.$btclient?.features.uploadFileSelection && this.visibleFileTree.length > 0
    }

    switchTab(tab: "general" | "files") {
        if (tab === "files" && !this.hasFilesTab()) {
            return
        }
        this.activeTab = tab
        this.updateIndeterminateCheckboxes()
    }

    toggleFileNode(node: UploadFileTreeNode) {
        this.setNodeSelection(node, node.partial ? true : !node.selected)
        this.syncFileSelectionOptions()
        this.updateIndeterminateCheckboxes()
    }

    getPendingUploadCountLabel() {
        const torrentCount = this.scope.torrents?.length || 0
        return `${torrentCount} ${torrentCount === 1 ? "torrent" : "torrents"} remaining`
    }

    discardCurrentTorrent() {
        this.scope.torrents.shift()
        if (this.scope.torrents.length === 0) {
            this.modalref.hideModal()
        } else {
            this.onShow()
        }
    }

    async uploadCurrentTorrent() {
        try {
            this.isLoading = true
            let torrent = this.getCurrentTorrentUpload()
            if (torrent.type === 'file') {
                await this.performTorrentUpload(torrent.data, torrent.filename, this.uploadOptions, torrent.sourcePath)
            } else {
                await this.performTorrentURIUpload(torrent.uri, this.uploadOptions)
            }
            this.scope.torrents.shift()
            if (this.scope.torrents.length === 0) {
                this.modalref.hideModal()
            } else {
                this.onShow()
            }
        } finally {
            this.isLoading = false
        }
    }

    openSavedLocationModal() {
        if (!this.rootScope.$server) {
            return
        }

        this.preserveUploadsOnHide = true
        this.savedLocationModalRef?.open({
            autoSave: true,
            onClose: () => {
                this.preserveUploadsOnHide = false
                this.restoreUploadOptionsOnShow = true
                this.modalref.showModal()
            },
            onSuccess: (savedLocation) => {
                this.uploadOptions.saveLocation = savedLocation.path
            },
            server: this.rootScope.$server,
            submitLabel: "Save location",
            title: "Add Saved Location",
        })
    }

    async performTorrentURIUpload(uri: string, options: TorrentUploadOptions) {
        if (this.scope.uploadTorrentUrlAction) {
            await this.scope.uploadTorrentUrlAction(uri, options)
        } else {
            await this.rootScope.$btclient.addTorrentUrl(uri, options)
        }
    }

    async performTorrentUpload(torrent: Uint8Array, filename: string, options: TorrentUploadOptions, sourcePath?: string) {
        if (this.scope.uploadTorrentAction) {
            await this.scope.uploadTorrentAction(torrent, filename, options, sourcePath)
        } else {
            await this.rootScope.$btclient.uploadTorrent(torrent, filename, options, sourcePath)
        }
    }

    private refreshUploadFiles() {
        const torrent = this.getCurrentTorrentUpload()
        const files = torrent?.metadata?.files || []
        if (!this.rootScope.$btclient?.features.uploadFileSelection || files.length === 0) {
            delete this.uploadOptions.fileSelection
            this.fileTree = []
            this.visibleFileTree = []
            this.activeTab = "general"
            return
        }

        this.fileTree = this.buildFileTree(files)
        this.visibleFileTree = this.flattenFileTree(this.fileTree)
        this.syncFileSelectionOptions()
        this.updateIndeterminateCheckboxes()
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

    private syncFileSelectionOptions() {
        if (!this.hasFilesTab()) {
            delete this.uploadOptions.fileSelection
            return
        }

        const fileSelection = this.visibleFileTree
            .filter((node) => node.fileIndex !== undefined)
            .map((node): BittorrentFileSelection => ({
                index: node.fileIndex!,
                path: node.path,
                name: node.name,
                size: node.size,
                wanted: node.selected,
            }))

        if (fileSelection.every((file) => file.wanted)) {
            delete this.uploadOptions.fileSelection
            return
        }

        this.uploadOptions.fileSelection = fileSelection
    }

    private updateIndeterminateCheckboxes() {
        this.$timeout(() => {
            this.visibleFileTree.forEach((node) => {
                const element = document.getElementById(`upload-file-cb-${node.id}`) as HTMLInputElement | null
                if (element) {
                    element.indeterminate = node.partial
                }
            })
        })
    }

}
