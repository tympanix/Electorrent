import { Component, EventEmitter, Input, Output } from "@angular/core"
import { CommonModule } from "@angular/common"

export interface ServerSelectionItem {
    id?: string
    getClientWarning?(): string
    getIcon?(): string
    getName?(): string
    getNameAtAddress?(): string
    isClientKnown(): boolean
}

@Component({
    selector: "server-selection",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./server-selection.template.html",
})
export class ServerSelectionDirective {
    @Input() servers: ServerSelectionItem[] = []
    @Output() readonly connectToServer = new EventEmitter<ServerSelectionItem>()

    connect(server: ServerSelectionItem) {
        this.connectToServer.emit(server)
    }

    getServerName(server: ServerSelectionItem) {
        return server.getName?.() || "Server"
    }

    getServerAddress(server: ServerSelectionItem) {
        return server.getNameAtAddress?.() || this.getServerName(server)
    }

    getServerWarning(server: ServerSelectionItem) {
        return server.getClientWarning?.() || "Unknown torrent client"
    }

    getServerIcon(server: ServerSelectionItem) {
        return server.getIcon?.() || ""
    }

    trackServer(index: number, server: ServerSelectionItem) {
        return server.id || `${this.getServerAddress(server)}-${index}`
    }
}

export { ServerSelectionDirective as ServerSelectionComponent }
