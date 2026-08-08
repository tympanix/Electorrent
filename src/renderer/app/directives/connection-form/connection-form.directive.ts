import { CommonModule } from "@angular/common";
import { Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, booleanAttribute } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { DropdownDirective, DropdownItemDirective } from "../dropdown/dropdown.directive";
import type { StoredServerConfig } from "@shared/ipc-contract";
import { parseServerAddressInput, sanitizeServerAddress } from "@shared/server-address";

type ConnectionFormServer = Pick<
    StoredServerConfig,
    "client" | "ip" | "password" | "path" | "port" | "proto" | "user"
> & {
    setPath(): void;
};

interface ConnectionFormClient {
    icon: string;
    name: string;
}

@Component({
    selector: "connection-form",
    standalone: true,
    imports: [CommonModule, FormsModule, DropdownDirective, DropdownItemDirective],
    templateUrl: "./connection-form.template.html",
})
export class ConnectionFormDirective implements OnChanges, OnDestroy {
    @Input({ required: true }) server!: ConnectionFormServer;
    @Input({ required: true }) btclients: Record<string, ConnectionFormClient> = {};
    @Input() connecting = false;
    @Input({ transform: booleanAttribute }) showSubmit = false;
    @Input({ transform: booleanAttribute }) showLabels = true;
    @Input({ transform: booleanAttribute }) large = false;
    @Output() submit = new EventEmitter<void>();
    @Output() serverChange = new EventEmitter<ConnectionFormServer>();

    readonly hostLocks = {
        scheme: false,
        port: false,
    };

    constructor() {
        document.addEventListener("pointerdown", this.captureClientSelection, true);
    }

    ngOnDestroy(): void {
        document.removeEventListener("pointerdown", this.captureClientSelection, true);
    }

    get clientEntries(): Array<[string, ConnectionFormClient]> {
        return Object.entries(this.btclients);
    }

    ngOnChanges(): void {
        if (this.server) {
            this.syncHostFields();
        }
    }

    submitForm(): void {
        Object.assign(this.server, sanitizeServerAddress(this.server));
        this.serverChange.emit(this.server);
        this.submit.emit();
    }

    setHost(ip: string): void {
        this.server.ip = ip;
        this.syncHostFields();
        this.serverChange.emit(this.server);
    }

    setProtocol(protocol: string): void {
        this.server.proto = protocol;
        this.serverChange.emit(this.server);
    }

    setPort(port: number): void {
        this.server.port = port;
        this.serverChange.emit(this.server);
    }

    setClient(client: string): void {
        if (!client || !this.btclients[client]) return;
        this.server.client = client;
        this.server.setPath();
        this.syncHostFields();
        this.serverChange.emit(this.server);
    }

    resetPath(): void {
        this.server.setPath();
        this.serverChange.emit(this.server);
    }

    fieldChanged(): void {
        this.serverChange.emit(this.server);
    }

    @HostListener("document:click", ["$event"])
    selectClickedClient(event: MouseEvent): void {
        const item = (event.target as Element | null)?.closest<HTMLElement>("[id^='connection-client-']");
        const client = item?.id.slice("connection-client-".length);
        if (client) this.setClient(client);
    }

    private syncHostFields(): void {
        const parsed = parseServerAddressInput(this.server.ip, this.server.proto);

        this.hostLocks.scheme = parsed.hasExplicitProtocol;
        if (parsed.protocol) {
            this.server.proto = parsed.protocol;
        }

        this.hostLocks.port = parsed.hasExplicitPort;
        if (parsed.port) {
            this.server.port = parsed.port;
        }
    }

    private readonly captureClientSelection = (event: Event): void => {
        const item = (event.target as Element | null)?.closest<HTMLElement>("[id^='connection-client-']");
        const client = item?.id.slice("connection-client-".length);
        if (client) this.setClient(client);
    };
}
