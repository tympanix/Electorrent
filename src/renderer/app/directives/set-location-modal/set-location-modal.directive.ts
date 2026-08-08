import {
    AfterViewInit,
    Component,
    EventEmitter,
    Inject,
    Input,
    OnDestroy,
    Output,
    ViewChild,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import { FormsModule } from "@angular/forms"
import {
    DropdownDirective,
    DropdownItemDirective,
} from "@renderer/app/directives/dropdown/dropdown.directive"
import { ModalDirective } from "@renderer/app/directives/modal/modal.directive"
import type { SavedLocationConfig } from "@shared/ipc-contract"

export interface SetLocationTorrent {
    decodedName?: string
    name?: string
    savePath?: string
}

export interface SetLocationClient {
    setLocation(torrents: SetLocationTorrent[], location: string): Promise<unknown>
}

export interface SetLocationServer {
    id: string
}

interface SetLocationRuntime {
    $btclient?: SetLocationClient
    $server?: SetLocationServer
}

interface SetLocationSettings {
    getServer(id: string): { savedLocations?: SavedLocationConfig[] } | undefined
}

export interface SetLocationModalRef {
    open(torrents: SetLocationTorrent[]): void
    close(): void
}

@Component({
    selector: "set-location-modal",
    standalone: true,
    imports: [CommonModule, FormsModule, DropdownDirective, DropdownItemDirective, ModalDirective],
    templateUrl: "./set-location-modal.template.html",
    exportAs: "setLocationModal",
})
export class SetLocationModalDirective implements AfterViewInit, OnDestroy, SetLocationModalRef {
    @Input() modalRef?: SetLocationModalRef
    @Output() readonly modalRefChange = new EventEmitter<SetLocationModalRef | undefined>()
    @Input() onSaved?: () => Promise<void> | void
    @Input() client?: SetLocationClient
    @Input() server?: SetLocationServer
    @Output() readonly saved = new EventEmitter<void>()

    @ViewChild("modal", { static: true }) private modal!: ModalDirective

    readonly handleHidden = () => this.onHidden()
    torrents: SetLocationTorrent[] = []
    location = ""
    loading = false
    error: string | null = null
    savedLocations: SavedLocationConfig[] = []

    private openWhenReady = false
    private viewInitialized = false

    constructor(
        @Inject("$rootScope") private readonly runtime: SetLocationRuntime,
        @Inject("settingsService") private readonly settingsService: SetLocationSettings,
    ) {}

    ngAfterViewInit() {
        this.viewInitialized = true
        this.modalRef = this
        this.modalRefChange.emit(this)
        if (this.openWhenReady) {
            this.openWhenReady = false
            this.modal.showModal()
        }
    }

    ngOnDestroy() {
        this.modalRefChange.emit(undefined)
    }

    open(torrents: SetLocationTorrent[]) {
        const serverId = (this.server || this.runtime.$server)?.id
        const server = serverId ? this.settingsService.getServer(serverId) : undefined
        this.savedLocations = Array.isArray(server?.savedLocations) ? server.savedLocations : []
        this.torrents = torrents.slice()
        const sharedLocation = this.getSharedLocation(torrents)
        this.location = this.savedLocations.some(({ path }) => path === sharedLocation) ? sharedLocation : ""
        this.error = null
        this.loading = false

        if (this.viewInitialized) {
            this.modal.showModal()
        } else {
            this.openWhenReady = true
        }
    }

    close() {
        if (this.viewInitialized) {
            this.modal.hideModal()
        } else {
            this.openWhenReady = false
            this.onHidden()
        }
    }

    getTargetLabel() {
        if (this.torrents.length === 1) {
            const torrent = this.torrents[0]
            return torrent?.decodedName || torrent?.name || "this torrent"
        }

        return `${this.torrents.length} selected torrents`
    }

    async apply() {
        if (!this.location || !this.torrents.length || this.loading) {
            return
        }

        try {
            this.loading = true
            this.error = null
            const client = this.client || this.runtime.$btclient
            if (!client || typeof client.setLocation !== "function") {
                throw new Error("Set location is not available for the current client")
            }
            await client.setLocation(this.torrents, this.location)
            await this.onSaved?.()
            this.saved.emit()
            this.close()
        } catch (error: any) {
            this.error = error?.message || "Failed to set location"
        } finally {
            this.loading = false
        }
    }

    trackSavedLocation(_index: number, savedLocation: SavedLocationConfig) {
        return savedLocation.path
    }

    private getSharedLocation(torrents: SetLocationTorrent[]) {
        if (!torrents.length) {
            return ""
        }

        const firstLocation = torrents[0]?.savePath || ""
        if (!firstLocation) {
            return ""
        }

        return torrents.every((torrent) => torrent?.savePath === firstLocation) ? firstLocation : ""
    }

    private onHidden() {
        this.torrents = []
        this.location = ""
        this.loading = false
        this.error = null
    }
}

export { SetLocationModalDirective as SetLocationModalComponent }
