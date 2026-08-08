import {
    Component,
    EventEmitter,
    Input,
    Output,
} from "@angular/core"
import { CommonModule } from "@angular/common"
import { RenameServerModalDirective } from "@renderer/app/directives/rename-server-modal/rename-server-modal.directive"

export interface SettingsServerItem {
    certificate?: string
    certificateData?: Uint8Array
    default?: boolean
    id?: string
    ip?: string
    port?: number
    proto?: string
    tlsSecurity?: string
    user?: string
    getClientWarning(): string
    getDisplayName(): string
    getName(): string
    isClientKnown(): boolean
}

export interface SettingsServersModel {
    servers: SettingsServerItem[]
}

export interface RenameServerData {
    server?: SettingsServerItem
    name: string
    reset(): void
}

interface RenameServerModalRef {
    open(server: SettingsServerItem): void
}

export type SettingsServerAction = (server: SettingsServerItem) => void

@Component({
    selector: "settings-servers",
    standalone: true,
    imports: [CommonModule, RenameServerModalDirective],
    templateUrl: "./settings-servers.template.html",
})
export class SettingsServersDirective {
    @Input() settings: SettingsServersModel = { servers: [] }
    @Input() renameData: RenameServerData = {
        name: "",
        reset: () => undefined,
    }
    @Input() onToggleDefaultServer?: SettingsServerAction
    @Input() onMoveServerUp?: SettingsServerAction
    @Input() onDisableInsecureTls?: SettingsServerAction
    @Input() onRemoveServer?: SettingsServerAction
    @Input() onRenameServer?: () => boolean

    @Output() readonly settingsChange = new EventEmitter<SettingsServersModel>()
    @Output() readonly defaultServerToggled = new EventEmitter<SettingsServerItem>()
    @Output() readonly serverMovedUp = new EventEmitter<SettingsServerItem>()
    @Output() readonly insecureTlsDisabled = new EventEmitter<SettingsServerItem>()
    @Output() readonly serverRemoved = new EventEmitter<SettingsServerItem>()

    renameModalRef?: RenameServerModalRef

    readonly renameServer = () => {
        const renamed = this.onRenameServer ? this.onRenameServer() : true
        if (renamed !== false) {
            this.settingsChange.emit(this.settings)
        }
        return renamed
    }

    toggleDefaultServer(server: SettingsServerItem, enabled: boolean) {
        server.default = enabled
        this.onToggleDefaultServer?.(server)
        this.defaultServerToggled.emit(server)
        this.settingsChange.emit(this.settings)
    }

    moveServerUp(server: SettingsServerItem) {
        this.onMoveServerUp?.(server)
        this.serverMovedUp.emit(server)
        this.settingsChange.emit(this.settings)
    }

    disableInsecureTls(server: SettingsServerItem) {
        this.onDisableInsecureTls?.(server)
        this.insecureTlsDisabled.emit(server)
        this.settingsChange.emit(this.settings)
    }

    removeServer(server: SettingsServerItem) {
        this.onRemoveServer?.(server)
        this.serverRemoved.emit(server)
        this.settingsChange.emit(this.settings)
    }

    openRenameModal(server: SettingsServerItem) {
        this.renameModalRef?.open(server)
    }

    trackServer(_index: number, server: SettingsServerItem) {
        return server.id || server
    }
}

export { SettingsServersDirective as SettingsServersComponent }
