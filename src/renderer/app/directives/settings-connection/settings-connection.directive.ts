import { Component, EventEmitter, Input, Output } from "@angular/core"
import { ConnectionFormDirective } from "@renderer/app/directives/connection-form/connection-form.directive"
import type { StoredServerConfig } from "@shared/ipc-contract"

export type SettingsConnectionServer = Pick<
    StoredServerConfig,
    "client" | "ip" | "password" | "path" | "port" | "proto" | "user"
> & {
    setPath(): void
}

export interface SettingsConnectionClient {
    icon: string
    name: string
}

@Component({
    selector: "settings-connection",
    standalone: true,
    imports: [ConnectionFormDirective],
    templateUrl: "./settings-connection.template.html",
})
export class SettingsConnectionDirective {
    @Input({ required: true }) server!: SettingsConnectionServer
    @Input({ required: true }) btclients: Record<string, SettingsConnectionClient> = {}
    @Input() connecting = false
    @Output() readonly serverChange = new EventEmitter<SettingsConnectionServer>()

    updateServer(server: SettingsConnectionServer) {
        this.server = server
        this.serverChange.emit(server)
    }
}

export { SettingsConnectionDirective as SettingsConnectionComponent }
