import {
    AfterViewInit,
    Component,
    DoCheck,
    ElementRef,
    EventEmitter,
    Input,
    OnDestroy,
    Output,
    ViewChild,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import type { TorrentClient, TorrentUploadOptions } from "@renderer/app/bittorrent/torrentclient"
import { TorrentUploadFileSelectionDirective } from "@renderer/app/directives/torrent-upload-file-selection/torrent-upload-file-selection.directive"
import { TorrentUploadFormDirective } from "@renderer/app/directives/torrent-upload-form/torrent-upload-form.directive"
import type {
    BittorrentFileSelection,
    SavedLocationConfig,
    TorrentMetadata,
} from "@shared/ipc-contract"

export type PendingTorrentUploadList = PendingTorrentUploadItem[]

export type PendingTorrentUploadItem = PendingTorrentUploadFile | PendingTorrentUploadLink

export interface PendingTorrentUploadFile {
    type: "file"
    data: Uint8Array
    filename: string
    metadata?: TorrentMetadata
    sourcePath?: string
}

export interface PendingTorrentUploadLink {
    type: "link"
    uri: string
    askUploadOptions?: boolean
    metadata?: TorrentMetadata
}

export interface SavedLocationRequest {
    server: AddTorrentModalServer
    complete: (savedLocation?: SavedLocationConfig) => void
}

export interface AddTorrentModalServer {
    defaultUploadOptionsEnabled?: boolean
    defaultUploadOptions?: TorrentUploadOptions
    savedLocations?: SavedLocationConfig[]
}

type UploadTorrentAction = (
    torrent: Uint8Array,
    filename: string,
    options: TorrentUploadOptions,
    sourcePath?: string,
) => Promise<void>

type UploadTorrentUrlAction = (uri: string, options: TorrentUploadOptions) => Promise<void>

/**
 * Angular replacement for the legacy `addTorrentModal` element directive.
 *
 * The runtime objects are inputs so the component is independent of the old
 * AngularJS root scope. The application shell owns those objects and can bind
 * them directly while it is being migrated.
 */
@Component({
    selector: "add-torrent-modal",
    standalone: true,
    imports: [CommonModule, TorrentUploadFileSelectionDirective, TorrentUploadFormDirective],
    templateUrl: "./add-torrent-modal.template.html",
})
export class AddTorrentModalDirective implements AfterViewInit, DoCheck, OnDestroy {
    static readonly defaultTorrentUploadOptions: TorrentUploadOptions = {
        startTorrent: true,
    }

    @Input() torrents: PendingTorrentUploadList = []
    @Output() readonly torrentsChange = new EventEmitter<PendingTorrentUploadList>()
    @Input() labels: string[] = []
    @Input() uploadTorrentAction?: UploadTorrentAction
    @Input() uploadTorrentUrlAction?: UploadTorrentUrlAction
    @Input() client?: TorrentClient
    @Input() server?: AddTorrentModalServer
    @Output() readonly savedLocationRequest = new EventEmitter<SavedLocationRequest>()

    @ViewChild("modal", { static: true }) private modalElement!: ElementRef<HTMLElement>

    uploadOptions: TorrentUploadOptions = {}
    isLoading = false
    activeTab: "general" | "files" = "general"

    private modal?: JQuery
    private previousTorrentCount = 0
    private preserveUploadsOnHide = false
    private restoreUploadOptionsOnShow = false

    ngAfterViewInit() {
        const modal = $(this.modalElement.nativeElement)
        this.modal = modal
        ;(modal as any).modal({
            onHidden: () => this.onHidden(),
            onShow: () => this.onShow(),
            onVisible: () => (modal as any).modal("refresh"),
            closable: false,
            keyboardShortcuts: false,
            duration: 150,
        })
        this.syncModalWithQueue()
    }

    ngDoCheck() {
        this.syncModalWithQueue()
    }

    ngOnDestroy() {
        if (this.modal) {
            ;(this.modal as any).modal("destroy")
        }
    }

    onShow() {
        if (this.restoreUploadOptionsOnShow) {
            this.restoreUploadOptionsOnShow = false
            return
        }

        const configuredOptions = this.server?.defaultUploadOptionsEnabled
            ? this.server.defaultUploadOptions
            : undefined

        this.uploadOptions = {
            ...AddTorrentModalDirective.defaultTorrentUploadOptions,
            ...(configuredOptions || {}),
        }
        this.activeTab = "general"
    }

    onHidden() {
        if (this.preserveUploadsOnHide) {
            return
        }
        this.torrents.splice(0)
        this.queueChanged()
    }

    supportsSavedLocations() {
        return !!this.client?.features.uploadOptions.saveLocation
    }

    getCurrentTorrentUpload() {
        return this.torrents[0]
    }

    getCurrentTorrentUploadLabel() {
        const torrent = this.getCurrentTorrentUpload()
        if (!torrent) {
            return ""
        }

        return torrent.metadata?.name || (torrent.type === "file" ? torrent.filename : torrent.uri)
    }

    getCurrentTorrentUploadSize() {
        const metadata = this.getCurrentTorrentUpload()?.metadata
        return metadata?.length || metadata?.files.reduce((size, file) => size + (file.length || 0), 0) || 0
    }

    getCurrentTorrentUploadFiles() {
        return this.getCurrentTorrentUpload()?.metadata?.files
    }

    hasFilesTab() {
        return !!this.client?.features.uploadFileSelection
            && !!this.getCurrentTorrentUploadFiles()?.length
    }

    switchTab(tab: "general" | "files") {
        if (tab !== "files" || this.hasFilesTab()) {
            this.activeTab = tab
        }
    }

    updateFileSelection(selection?: BittorrentFileSelection[]) {
        if (selection) {
            this.uploadOptions = { ...this.uploadOptions, fileSelection: selection }
        } else {
            const { fileSelection: _fileSelection, ...uploadOptions } = this.uploadOptions
            this.uploadOptions = uploadOptions
        }
    }

    getPendingUploadCountLabel() {
        const torrentCount = this.torrents.length
        return `${torrentCount} ${torrentCount === 1 ? "torrent" : "torrents"} remaining`
    }

    discardCurrentTorrent() {
        this.removeCurrentTorrent()
    }

    async uploadCurrentTorrent() {
        const torrent = this.getCurrentTorrentUpload()
        if (!torrent || this.isLoading) {
            return
        }

        try {
            this.isLoading = true
            if (torrent.type === "file") {
                await this.performTorrentUpload(
                    torrent.data,
                    torrent.filename,
                    this.uploadOptions,
                    torrent.sourcePath,
                )
            } else {
                await this.performTorrentURIUpload(torrent.uri, this.uploadOptions)
            }
            this.removeCurrentTorrent()
        } finally {
            this.isLoading = false
        }
    }

    openSavedLocationModal() {
        if (!this.server) {
            return
        }

        this.preserveUploadsOnHide = true
        this.hideModal()
        const request: SavedLocationRequest = {
            server: this.server,
            complete: (savedLocation) => {
                this.preserveUploadsOnHide = false
                this.restoreUploadOptionsOnShow = true
                if (savedLocation) {
                    this.uploadOptions = {
                        ...this.uploadOptions,
                        saveLocation: savedLocation.path,
                    }
                }
                this.showModal()
            },
        }
        this.savedLocationRequest.emit(request)
        if (!this.savedLocationRequest.observed) {
            request.complete()
        }
    }

    formatBytes(value: number, fractionSize = 1) {
        if (!Number.isFinite(value) || value < 0) {
            return ""
        }
        if (value === 0) {
            return "0 B"
        }

        const unit = 1024
        const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
        const index = Math.floor(Math.log(value) / Math.log(unit))
        return `${parseFloat((value / Math.pow(unit, index)).toFixed(fractionSize))} ${sizes[index]}`
    }

    private async performTorrentURIUpload(uri: string, options: TorrentUploadOptions) {
        if (this.uploadTorrentUrlAction) {
            return this.uploadTorrentUrlAction(uri, options)
        }
        if (!this.client) {
            throw new Error("A torrent client or uploadTorrentUrlAction is required")
        }
        return this.client.addTorrentUrl(uri, options)
    }

    private async performTorrentUpload(
        torrent: Uint8Array,
        filename: string,
        options: TorrentUploadOptions,
        sourcePath?: string,
    ) {
        if (this.uploadTorrentAction) {
            return this.uploadTorrentAction(torrent, filename, options, sourcePath)
        }
        if (!this.client) {
            throw new Error("A torrent client or uploadTorrentAction is required")
        }
        return this.client.uploadTorrent(torrent, filename, options, sourcePath)
    }

    private removeCurrentTorrent() {
        this.torrents.shift()
        this.queueChanged()
        if (this.torrents.length === 0) {
            this.hideModal()
        } else {
            this.onShow()
        }
    }

    private queueChanged() {
        this.previousTorrentCount = this.torrents.length
        this.torrentsChange.emit(this.torrents)
    }

    private syncModalWithQueue() {
        const torrentCount = this.torrents?.length || 0
        if (torrentCount > 0 && this.previousTorrentCount === 0) {
            this.showModal()
        } else if (torrentCount === 0 && this.previousTorrentCount > 0) {
            this.hideModal()
        }
        this.previousTorrentCount = torrentCount
    }

    private showModal() {
        if (this.modal) {
            ;(this.modal as any).modal("show")
        }
    }

    private hideModal() {
        if (this.modal) {
            ;(this.modal as any).modal("hide")
        }
    }
}

export { AddTorrentModalDirective as AddTorrentModalComponent }
