import {
    ChangeDetectorRef,
    Component,
    Inject,
    NgZone,
    OnDestroy,
    OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { DragAndDropDirective } from "@renderer/app/directives/drag-and-drop/drag-and-drop.directive";
import { NotificationsCenterComponent } from "@renderer/app/directives/notifications-center/notifications-center.directive";
import { ServerSelectionDirective } from "@renderer/app/directives/server-selection/server-selection.directive";
import { SettingsPageDirective } from "@renderer/app/directives/settings-page/settings-page.directive";
import { TitleBarMenuDirective } from "@renderer/app/directives/title-bar-menu/title-bar-menu.directive";
import { TorrentsPageDirective } from "@renderer/app/directives/torrents-page/torrents-page.directive";
import { WelcomePageComponent } from "@renderer/app/directives/welcome-page/welcome-page.directive";
import type {
    AppMeta,
    LaunchPayload,
    MenuAction,
    PendingTorrentUploadFile,
    PendingTorrentUploadLink,
} from "@shared/ipc-contract";

interface AppShellServer {
    id: string;
    ip?: string;
    isConnected?: boolean;
    name?: string;
    connect(): Promise<unknown>;
    getDisplayName?(): string;
    isClientKnown(): boolean;
}

interface AppShellRootEvents {
    $activeServer?: AppShellServer | null;
    $btclient?: unknown | null;
    $server?: AppShellServer | null;
    $syncConnection?: { state?: string } | null;
    $broadcast(name: string, ...args: unknown[]): void;
    $emit(name: string, ...args: unknown[]): void;
    $on(name: string, callback: (event: unknown, ...args: any[]) => void): () => void;
}

interface AppShellSettingsService {
    getAllSettings(): {
        automaticUpdates?: boolean;
        servers: AppShellServer[];
        startup?: string;
    };
    getDefaultServer(): AppShellServer | undefined;
    getRecentServer(): AppShellServer | undefined;
    getServer(id: string): AppShellServer | undefined;
    getServers(): AppShellServer[];
    setCurrentServerAsDefault(): void;
    updateServer(server: AppShellServer): Promise<unknown> | void;
    whenReady(): Promise<unknown>;
}

interface AppShellNotifications {
    alert(title: string, message: string): void;
    ok(title: string, message: string): void;
}

interface AppShellBittorrentService {
    uploadFromClipboard(askUploadOptions: boolean): void;
}

type PendingFile = PendingTorrentUploadFile & { askUploadOptions?: boolean };
type PendingLink = PendingTorrentUploadLink & { askUploadOptions?: boolean };

const MAX_LOADING_TIME = 10_000;
const PAGE_SETTINGS = "settings";
const PAGE_WELCOME = "welcome";
const PAGE_SERVERS = "servers";
const PAGE_TORRENTS = "torrents";

/**
 * The top-level renderer shell.
 *
 * The string injection tokens deliberately retain the service names used by the
 * renderer. The Angular bootstrap layer can therefore provide the migrated
 * services without coupling this component to their concrete implementations.
 */
@Component({
    selector: "app-shell",
    standalone: true,
    imports: [
        CommonModule,
        DragAndDropDirective,
        NotificationsCenterComponent,
        ServerSelectionDirective,
        SettingsPageDirective,
        TitleBarMenuDirective,
        TorrentsPageDirective,
        WelcomePageComponent,
    ],
    templateUrl: "./app-shell.template.html",
})
export class AppShellComponent implements OnInit, OnDestroy {
    servers: AppShellServer[] = [];
    showTorrents = false;
    showLoading = true;
    statusText = "Loading";
    hasBrowserTitleBarMenu = false;
    currentPage: string | null = null;

    private activeConnectionId = 0;
    private initialLaunchPayloadDelivered = false;
    private initialLaunchPayloadPromise: Promise<LaunchPayload> | null = null;
    private loadingTimer?: number;
    private readonly pendingMagnets: PendingLink[] = [];
    private readonly pendingTorrentFiles: PendingFile[] = [];
    private readonly destroyCallbacks: Array<() => void> = [];

    constructor(
        @Inject("$rootScope") private readonly rootEvents: AppShellRootEvents,
        @Inject("$bittorrent") private readonly bittorrent: AppShellBittorrentService,
        @Inject("settingsService") private readonly settingsService: AppShellSettingsService,
        @Inject("notificationService") private readonly notifications: AppShellNotifications,
        private readonly zone: NgZone,
        private readonly changeDetector: ChangeDetectorRef,
    ) {}

    ngOnInit(): void {
        this.servers = this.settingsService.getServers();
        this.registerAppEvents();
        this.registerLaunchEvents();
        this.registerMenuEvents();
        this.initialize();
    }

    ngOnDestroy(): void {
        if (this.loadingTimer !== undefined) {
            window.clearTimeout(this.loadingTimer);
        }
        this.destroyCallbacks.splice(0).forEach((destroy) => destroy());
    }

    get connectedServerName(): string {
        return this.rootEvents.$server?.getDisplayName?.() || "";
    }

    get syncConnectionState(): string {
        return this.rootEvents.$syncConnection?.state || "normal";
    }

    get showSyncConnectionIndicator(): boolean {
        return this.syncConnectionState !== "normal";
    }

    get syncConnectionMessage(): string {
        return this.syncConnectionState === "broken"
            ? "Connection lost. Trying to reconnect."
            : "Server response is slower than usual.";
    }

    get showTitleBarMenu(): boolean {
        return this.hasBrowserTitleBarMenu;
    }

    get showSettings(): boolean {
        return this.currentPage === PAGE_SETTINGS;
    }

    get showWelcome(): boolean {
        return this.currentPage === PAGE_WELCOME;
    }

    get showServers(): boolean {
        return this.currentPage === PAGE_SERVERS;
    }

    connectToServer(server: AppShellServer): void {
        const connectionId = ++this.activeConnectionId;
        const isCurrentConnection = () => connectionId === this.activeConnectionId;

        this.showLoading = true;
        this.rootEvents.$broadcast("stop:torrents");
        this.rootEvents.$broadcast("wipe:torrents");
        this.rootEvents.$activeServer = server;
        if (!server.isConnected) {
            this.rootEvents.$btclient = null;
            this.rootEvents.$server = null;
        }
        const serverName = server.getDisplayName?.() || server.name || server.ip || "server";
        this.statusText = `Connecting to ${serverName}`;

        const connection = server.isConnected ? Promise.resolve() : server.connect();
        connection.then(() => {
            if (!isCurrentConnection()) {
                return;
            }

            this.statusText = "Loading Torrents";
            this.settingsService.updateServer(server);
            this.pageTorrents(true);
            if (this.initialLaunchPayloadDelivered) {
                return;
            }
            this.initialLaunchPayloadPromise ||= window.electorrent.launch.getPending();
            return this.initialLaunchPayloadPromise.then((payload) => {
                if (!isCurrentConnection() || this.initialLaunchPayloadDelivered) {
                    return;
                }

                this.initialLaunchPayloadDelivered = true;
                this.queueMagnetLinks(payload.magnets || []);
                this.queueTorrentFiles(payload.torrentFiles || []);
                this.drainPendingLaunchPayloads();
            });
        }).catch((error: unknown) => {
            console.error(error);
            if (isCurrentConnection()) {
                this.zone.run(() => this.pageSettings("connection", server.id));
            }
        });
    }

    private registerAppEvents(): void {
        this.listen("add:server", () => {
            this.rootEvents.$broadcast("stop:torrents");
            this.rootEvents.$activeServer = null;
            this.rootEvents.$btclient = null;
            this.pageWelcome();
        });
        this.listen("connect:server", (server: AppShellServer) => this.connectToServer(server));
        this.listen("show:settings", () => {
            if (this.currentPage === PAGE_WELCOME || this.currentPage === PAGE_SERVERS) {
                return;
            }
            this.rootEvents.$broadcast("setting:load");
            this.currentPage = PAGE_SETTINGS;
        });
        this.listen("show:servers", () => this.pageServers());
        this.listen("hide:loading", () => {
            if (this.loadingTimer !== undefined) {
                window.clearTimeout(this.loadingTimer);
                this.loadingTimer = undefined;
            }
            this.showLoading = false;
        });
        this.listen("show:welcome", () => this.pageWelcome());
        this.listen("show:torrents", () => this.pageTorrents());
        this.listen("emit:new:settings", (data: unknown) => {
            this.rootEvents.$broadcast("new:settings", data);
        });
        this.listen("loading", (message: string) => {
            this.statusText = message;
            this.showLoading = true;
            if (this.loadingTimer !== undefined) {
                window.clearTimeout(this.loadingTimer);
            }
            this.loadingTimer = window.setTimeout(() => this.zone.run(() => {
                this.showLoading = false;
                this.notifications.alert(
                    "Loading took too long",
                    "There seems to be something wrong with loading",
                );
            }), MAX_LOADING_TIME);
        });
        this.listen("sync-connection-state", () => this.changeDetector.detectChanges());
    }

    private registerLaunchEvents(): void {
        const magnetsCleanup = window.electorrent.launch.onMagnets((magnets) => this.zone.run(() => {
            this.queueMagnetLinks(magnets);
            this.drainPendingLaunchPayloads();
        }));
        const filesCleanup = window.electorrent.launch.onTorrentFiles((files) => this.zone.run(() => {
            this.queueTorrentFiles(files);
            this.drainPendingLaunchPayloads();
        }));
        this.addCleanup(magnetsCleanup);
        this.addCleanup(filesCleanup);
    }

    private registerMenuEvents(): void {
        const cleanup = window.electorrent.menu.onAction((action) => this.zone.run(() => {
            this.handleMenuAction(action);
        }));
        this.addCleanup(cleanup);
    }

    private initialize(): void {
        // Render a usable first-run screen immediately while persisted settings
        // and platform metadata are loaded over IPC.
        this.pageWelcome();
        Promise.all([this.settingsService.whenReady(), window.electorrent.app.getMeta()])
            .then(([, meta]: [unknown, AppMeta]) => {
                this.hasBrowserTitleBarMenu = meta.isWindows || meta.isLinux || meta.forceTitleBarMenu;
                const settings = this.settingsService.getAllSettings();
                if (!meta.isDebug && settings.automaticUpdates !== false) {
                    window.electorrent.updates.check();
                }

                if (!settings.servers.length) {
                    this.pageWelcome();
                    return;
                }

                if (settings.startup === "default") {
                    this.connectConfiguredServer(
                        this.settingsService.getDefaultServer(),
                        "No default server",
                        "Please choose a server to connect to",
                    );
                } else if (settings.startup === "latest") {
                    this.connectConfiguredServer(
                        this.settingsService.getRecentServer(),
                        "No recent servers",
                        "Please choose a server to connect to",
                    );
                } else {
                    this.pageServers();
                }
            }).catch((error: unknown) => {
                console.error("Could not initialize renderer", error);
                this.pageWelcome();
            });
    }

    private connectConfiguredServer(
        server: AppShellServer | undefined,
        missingTitle: string,
        missingMessage: string,
    ): void {
        if (!server) {
            this.pageServers();
            this.notifications.ok(missingTitle, missingMessage);
        } else if (server.isClientKnown()) {
            this.connectToServer(server);
        } else {
            this.pageServers();
        }
    }

    private handleMenuAction(action: MenuAction): void {
        switch (action.type) {
            case "show-settings":
                this.rootEvents.$emit("show:settings");
                break;
            case "show-servers":
                this.rootEvents.$emit("show:servers");
                break;
            case "search-torrent":
                this.rootEvents.$broadcast("search:torrent");
                break;
            case "select-all": {
                const activeElement = document.activeElement;
                if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
                    activeElement.select();
                } else if (this.currentPage === PAGE_TORRENTS) {
                    this.rootEvents.$broadcast("select:torrents");
                }
                break;
            }
            case "remove-selected":
                if (document.activeElement?.nodeName !== "INPUT" && this.currentPage === PAGE_TORRENTS) {
                    this.rootEvents.$broadcast("remove:torrents");
                }
                break;
            case "remove-and-delete-selected":
                if (document.activeElement?.nodeName !== "INPUT" && this.currentPage === PAGE_TORRENTS) {
                    this.rootEvents.$broadcast("remove-and-delete:torrents");
                }
                break;
            case "open-add-torrent":
                window.electorrent.torrents.openFiles(!!action.askUploadOptions).then((files) => {
                    files.forEach((file) => this.broadcastTorrentFile(file, !!file.askUploadOptions));
                });
                break;
            case "paste-torrent-url":
                this.bittorrent.uploadFromClipboard(!!action.askUploadOptions);
                break;
            case "open-external":
                window.electorrent.shell.openExternal(action.url);
                break;
            case "check-for-updates":
                window.electorrent.updates.check(!!action.verbose);
                break;
            case "connect-server": {
                const server = this.settingsService.getServer(action.serverId);
                if (server) {
                    this.rootEvents.$emit("connect:server", server);
                }
                break;
            }
            case "set-current-default-server":
                this.settingsService.setCurrentServerAsDefault();
                break;
            case "add-server":
                this.rootEvents.$emit("add:server");
                break;
            case "torrent-action":
                this.rootEvents.$broadcast("torrent-action", action.action);
                break;
        }
    }

    private queueMagnetLinks(magnets: PendingTorrentUploadLink[], askUploadOptions = false): void {
        this.pendingMagnets.push(...magnets.map((link) => ({
            ...link,
            askUploadOptions: link.askUploadOptions ?? askUploadOptions,
        })));
    }

    private queueTorrentFiles(files: PendingFile[]): void {
        this.pendingTorrentFiles.push(...files);
    }

    private drainPendingLaunchPayloads(): void {
        if (!this.rootEvents.$btclient || !this.rootEvents.$server?.isConnected) {
            return;
        }
        this.pendingMagnets.splice(0).forEach((magnet) => {
            this.broadcastTorrentLink(magnet, !!magnet.askUploadOptions);
        });
        this.pendingTorrentFiles.splice(0).forEach((file) => {
            this.broadcastTorrentFile(file, !!file.askUploadOptions);
        });
    }

    private broadcastTorrentFile(file: PendingTorrentUploadFile, askUploadOptions: boolean): void {
        const pendingFile: PendingTorrentUploadFile = {
            type: "file",
            data: new Uint8Array(file.data),
            filename: file.filename,
            metadata: file.metadata,
            sourcePath: file.sourcePath,
        };
        this.rootEvents.$broadcast("torrents:add", pendingFile, askUploadOptions);
    }

    private broadcastTorrentLink(link: PendingTorrentUploadLink, askUploadOptions: boolean): void {
        const pendingLink: PendingTorrentUploadLink = {
            type: "link",
            uri: link.uri,
            metadata: link.metadata,
        };
        this.rootEvents.$broadcast("torrents:add", pendingLink, askUploadOptions);
    }

    private pageTorrents(fullUpdate?: boolean): void {
        this.showTorrents = true;
        this.currentPage = PAGE_TORRENTS;
        // Materialize the page before publishing its start event. AngularJS
        // linked the directive synchronously; Angular renders it at the next
        // change-detection boundary, which could otherwise make the initial
        // broadcast race the component's event subscriptions.
        this.changeDetector.detectChanges();
        window.setTimeout(() => this.zone.run(() => {
            this.rootEvents.$broadcast("start:torrents", fullUpdate);
            this.showLoading = false;
            this.changeDetector.detectChanges();
        }), 0);
    }

    private pageSettings(settingsPage?: string, serverId?: string): void {
        this.showLoading = false;
        this.currentPage = PAGE_SETTINGS;
        // Create the settings component before delivering page/load events so
        // its migrated root-event subscriptions cannot miss initial routing.
        this.changeDetector.detectChanges();
        this.rootEvents.$broadcast("setting:load", serverId);
        if (settingsPage) {
            this.rootEvents.$broadcast("settings:page", settingsPage, true);
        }
    }

    private pageServers(): void {
        this.showLoading = false;
        this.showTorrents = false;
        this.currentPage = PAGE_SERVERS;
        this.changeDetector.detectChanges();
    }

    private pageWelcome(): void {
        this.showLoading = false;
        this.currentPage = PAGE_WELCOME;
        this.changeDetector.detectChanges();
    }

    private listen(name: string, callback: (...args: any[]) => void): void {
        this.destroyCallbacks.push(this.rootEvents.$on(name, (_event, ...args) => {
            this.zone.run(() => callback(...args));
        }));
    }

    private addCleanup(cleanup: unknown): void {
        if (typeof cleanup === "function") {
            this.destroyCallbacks.push(cleanup as () => void);
        }
    }
}

// Transitional alias for imports that still use the old directive name. The
// value is an Angular component, not an AngularJS directive factory.
export { AppShellComponent as AppShellDirective };
