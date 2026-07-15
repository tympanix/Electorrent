import { TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient";
import { ModalController } from "@renderer/app/directives/modal/modal.controller";
import { SavedLocationModalController } from "@renderer/app/directives/saved-location-modal/saved-location-modal.controller";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import { AddTorrentModalScope } from "./add-torrent-modal.directive";
import type { BittorrentFileSelection } from "@shared/ipc-contract";

export class AddTorrentModalController {

    static $inject = ["$scope", "$rootScope"]

    static defaultTorrentUploadOptions: TorrentUploadOptions = {
        startTorrent: true,
    }

    scope: AddTorrentModalScope
    rootScope: ElectorrentRootScope
    modalref: ModalController
    savedLocationModalRef: SavedLocationModalController
    uploadOptions: TorrentUploadOptions
    isLoading: boolean
    activeTab: "general" | "files" = "general"
    private preserveUploadsOnHide: boolean
    private restoreUploadOptionsOnShow: boolean

    constructor(scope: AddTorrentModalScope, rootScope: ElectorrentRootScope) {
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
    }

    onHidden() {
        if (this.preserveUploadsOnHide) {
            return
        }
        this.scope.torrents = []
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

    getCurrentTorrentUploadFiles() {
        return this.getCurrentTorrentUpload()?.metadata?.files
    }

    hasFilesTab() {
        return !!this.rootScope.$btclient?.features.uploadFileSelection
            && !!this.getCurrentTorrentUploadFiles()?.length
    }

    switchTab(tab: "general" | "files") {
        if (tab === "files" && !this.hasFilesTab()) {
            return
        }
        this.activeTab = tab
    }

    updateFileSelection(selection?: BittorrentFileSelection[]) {
        if (selection) {
            this.uploadOptions.fileSelection = selection
        } else {
            delete this.uploadOptions.fileSelection
        }
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

}
