import { Component, EventEmitter, Inject, Output } from "@angular/core";
import { ConnectionFormDirective } from "@renderer/app/directives/connection-form/connection-form.directive";

interface WelcomeServer {
    client: string;
    connect(): PromiseLike<unknown>;
    isConnected?: boolean;
    ip: string;
    password: string;
    path: string;
    port: number;
    proto: string;
    setPath(): void;
    user: string;
}

interface WelcomeClient {
    icon: string;
    name: string;
}

interface WelcomeSettingsService {
    saveServer(server: WelcomeServer): PromiseLike<unknown>;
}

interface WelcomeNotificationService {
    ok(title: string, message: string): void;
}

type WelcomeServerConstructor = new () => WelcomeServer;

@Component({
    selector: "welcome-page",
    standalone: true,
    imports: [ConnectionFormDirective],
    templateUrl: "./welcome-page.template.html",
})
export class WelcomePageComponent {
    @Output() readonly serverConnected = new EventEmitter<WelcomeServer>();

    connecting = false;
    server: WelcomeServer;

    constructor(
        @Inject("$btclients") readonly btclients: Record<string, WelcomeClient>,
        @Inject("settingsService") private readonly settingsService: WelcomeSettingsService,
        @Inject("notificationService") private readonly notifications: WelcomeNotificationService,
        @Inject("Server") private readonly Server: WelcomeServerConstructor,
    ) {
        this.server = new this.Server();
    }

    async connect(): Promise<void> {
        if (this.connecting) return;

        const server = this.server;
        this.connecting = true;
        try {
            await server.connect();
            void Promise.resolve(this.settingsService.saveServer(server)).catch((error) => console.error(error));
            this.serverConnected.emit(server);
            this.server = new this.Server();
            this.notifications.ok("Success!", "Hooray! Welcome to Electorrent");
        } catch (error) {
            console.error(error);
        } finally {
            this.connecting = false;
        }
    }
}

// Transitional alias for imports that still use the old directive name.
export { WelcomePageComponent as WelcomePageDirective };
