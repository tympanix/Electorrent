import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, Inject, OnDestroy, OnInit } from "@angular/core";
import { SettingsAboutDirective } from "@renderer/app/directives/settings-about/settings-about.directive";
import { SettingsAdvancedDirective } from "@renderer/app/directives/settings-advanced/settings-advanced.directive";
import { SettingsConnectionDirective } from "@renderer/app/directives/settings-connection/settings-connection.directive";
import { SettingsGeneralComponent, type GeneralIntegrationSettings, type SettingsGeneralPlatform } from "@renderer/app/directives/settings-general/settings-general.directive";
import { SettingsLayoutDirective } from "@renderer/app/directives/settings-layout/settings-layout.directive";
import { SettingsServersDirective } from "@renderer/app/directives/settings-servers/settings-servers.directive";
import type { AppMeta, AppSettings, StoredServerConfig, ThemeInfo } from "@shared/ipc-contract";
import { createDefaultSettings } from "@shared/settings-defaults";

interface SettingsPageServer extends StoredServerConfig {
    certificateData?: Uint8Array;
    isConnected: boolean;
    columns: any[];
    connect(): Promise<unknown>;
    equals(other: Partial<SettingsPageServer>): boolean;
    getClientWarning(): string;
    getDisplayName(): string;
    getName(): string;
    getNameAtAddress(): string;
    isClientKnown(): boolean;
    setPath(): void;
}

interface SettingsPageClient {
    icon: string;
    name: string;
}

interface SettingsPageRootEvents {
    $server?: { id?: string };
    $broadcast(name: string, ...args: unknown[]): void;
    $emit(name: string, ...args: unknown[]): void;
    $on(name: string, callback: (event: unknown, ...args: any[]) => void): () => void;
}

interface SettingsPageSettingsService {
    getAllSettingsCopy(): AppSettings<SettingsPageServer>;
    saveAllSettings(settings: AppSettings<SettingsPageServer>): Promise<void>;
    updateServer(server: SettingsPageServer): Promise<unknown>;
    whenReady(): Promise<unknown>;
}

interface SettingsPageNotifications {
    alert(title: string, message: unknown): void;
    ok(title: string, message: string): void;
}

interface RenameData {
    server?: SettingsPageServer;
    name: string;
    reset(): void;
}

const UNKNOWN_PLATFORM: SettingsGeneralPlatform = {
    macOS: () => false,
    windows: () => false,
    linux: () => false,
};

@Component({
    selector: "settings-page",
    standalone: true,
    imports: [
        CommonModule,
        SettingsAboutDirective,
        SettingsAdvancedDirective,
        SettingsConnectionDirective,
        SettingsGeneralComponent,
        SettingsLayoutDirective,
        SettingsServersDirective,
    ],
    templateUrl: "./settings-page.template.html",
})
export class SettingsPageDirective implements OnInit, OnDestroy {
    settings: AppSettings<SettingsPageServer> = createDefaultSettings() as AppSettings<SettingsPageServer>;
    server?: SettingsPageServer;
    themes: ThemeInfo[] = [];
    btclients: Record<string, SettingsPageClient>;
    platform: SettingsGeneralPlatform = UNKNOWN_PLATFORM;
    general: GeneralIntegrationSettings = { magnets: false };
    renameData: RenameData = {
        server: undefined,
        name: "",
        reset() {
            this.name = this.server?.getNameAtAddress() || "";
        },
    };
    appVersion = "";
    nodeVersion = "";
    chromeVersion = "";
    electronVersion = "";
    connecting = false;
    page = "general";
    force = false;
    readonly layoutSortOptions = {
        handle: ".sort.handle",
        "ui-floating": true,
    };

    private serverCopy?: Partial<SettingsPageServer>;
    private loadPromise?: Promise<void>;
    private readonly destroyCallbacks: Array<() => void> = [];
    private readonly electorrent = window.electorrent;

    constructor(
        @Inject("$rootScope") private readonly rootEvents: SettingsPageRootEvents,
        @Inject("$btclients") btclients: Record<string, SettingsPageClient>,
        @Inject("settingsService") private readonly settingsService: SettingsPageSettingsService,
        @Inject("notificationService") private readonly notifications: SettingsPageNotifications,
        private readonly changeDetector: ChangeDetectorRef,
    ) {
        this.btclients = btclients;
    }

    ngOnInit(): void {
        this.loadPromise = Promise.all([
            this.settingsService.whenReady(),
            this.electorrent.settings.listThemes(),
            this.electorrent.app.getMeta(),
        ]).then(([_settingsReady, themes, meta]: [unknown, ThemeInfo[], AppMeta]) => {
            this.themes = themes;
            this.applyMeta(meta);
            return this.loadAllSettings();
        });

        this.destroyCallbacks.push(
            this.rootEvents.$on("setting:load", (_event, serverId?: string) => {
                void this.loadPromise?.then(() => this.loadAllSettings(serverId));
            }),
            this.rootEvents.$on("settings:page", (_event, page: string, force: boolean) => {
                this.force = !!force;
                this.gotoPage(page);
                this.changeDetector.detectChanges();
            }),
        );
    }

    ngOnDestroy(): void {
        this.destroyCallbacks.splice(0).forEach((destroy) => destroy());
    }

    activeOn(page: string): boolean {
        return this.page === page;
    }

    gotoPage(page: string): void {
        this.page = page;
    }

    close(): void {
        if (this.server?.isConnected) {
            this.rootEvents.$emit("show:torrents");
            void this.loadAllSettings();
        } else {
            this.rootEvents.$emit("show:servers");
        }
    }

    async save(): Promise<void> {
        this.rootEvents.$emit("loading", "Applying Settings");

        try {
            await this.saveServer();
            await this.writeSettings();
            this.close();
            this.rootEvents.$broadcast("new:settings", this.settings);
            this.notifications.ok("Saved Settings", "Your settings have been updated");
        } catch (error) {
            this.rootEvents.$emit("hide:loading");
            console.error("Settings Error", error);
        } finally {
            this.connecting = false;
        }
    }

    renameServer(): boolean {
        if (!this.renameData.name || !this.renameData.server) {
            return false;
        }
        this.renameData.server.name = this.renameData.name;
        return true;
    }

    moveServerUp(server: SettingsPageServer): void {
        const index = this.settings.servers.indexOf(server);
        if (index > 0) {
            const previous = this.settings.servers[index - 1];
            this.settings.servers[index - 1] = server;
            this.settings.servers[index] = previous;
        }
    }

    toggleDefaultServer(server: SettingsPageServer): void {
        if (server.default === true) {
            this.settings.servers.forEach((candidate) => {
                if (server !== candidate) {
                    candidate.default = false;
                }
            });
        }
    }

    disableInsecureTls(server: SettingsPageServer): void {
        server.tlsSecurity = "default";
        server.certificate = undefined;
        server.certificateData = undefined;
    }

    removeServer(server: SettingsPageServer): void {
        if (this.rootEvents.$server?.id === server.id) {
            this.notifications.alert("Server in use", "Can't remove a server that is currently being used");
            return;
        }

        this.settings.servers = this.settings.servers.filter((item) => item.id !== server.id);
    }

    private applyMeta(meta: AppMeta): void {
        this.appVersion = meta.appVersion;
        this.nodeVersion = meta.versions.node;
        this.chromeVersion = meta.versions.chrome;
        this.electronVersion = meta.versions.electron;
        this.platform = {
            macOS: () => meta.isMacOS,
            windows: () => meta.isWindows,
            linux: () => meta.isLinux,
        };
    }

    private async loadAllSettings(serverId?: string): Promise<void> {
        this.settings = this.settingsService.getAllSettingsCopy();
        this.loadServerReference(serverId);
        this.serverCopy = this.server ? { ...this.server } : undefined;
        this.general = {
            magnets: await this.electorrent.app.getDefaultProtocolStatus("magnet"),
        };
        this.changeDetector.detectChanges();
    }

    private loadServerReference(serverId?: string): void {
        const selectedServerId = serverId || this.rootEvents.$server?.id;
        if (selectedServerId) {
            this.server = this.settings.servers.find((server) => server.id === selectedServerId);
        }
    }

    private async saveServer(): Promise<void> {
        if (!this.server || (this.serverCopy && this.server.equals(this.serverCopy) && this.server.isConnected)) {
            return;
        }

        this.serverCopy = { ...this.server };
        this.connecting = true;
        await this.server.connect();
        await this.settingsService.updateServer(this.server);
    }

    private async writeSettings(): Promise<void> {
        try {
            await this.settingsService.saveAllSettings(this.settings);
            await this.electorrent.app.setDefaultProtocolStatus("magnet", this.general.magnets);
        } catch (error) {
            this.notifications.alert("Settings could not be saved", error);
            throw error;
        }
    }
}
