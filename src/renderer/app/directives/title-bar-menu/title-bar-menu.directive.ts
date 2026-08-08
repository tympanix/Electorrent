import { CommonModule } from "@angular/common";
import { Component, HostListener, Inject, Input, NgZone, OnDestroy, OnInit } from "@angular/core";
import type { MenuAction, PendingTorrentUploadFile } from "@shared/ipc-contract";
import type { TitleMenuAction, TitleMenuItem } from "@shared/title-menu";

interface TitleBarRootEvents {
    $broadcast(name: string, ...args: unknown[]): void;
    $emit(name: string, ...args: unknown[]): void;
}

interface TitleBarBittorrentService {
    uploadFromClipboard(askUploadOptions: boolean): void;
}

interface TitleBarSettingsService {
    getServer(id: string): unknown;
    setCurrentServerAsDefault(): void;
}

const PAGE_TORRENTS = "torrents";

@Component({
    selector: "title-bar-menu",
    standalone: true,
    imports: [CommonModule],
    templateUrl: "./title-bar-menu.template.html",
})
export class TitleBarMenuDirective implements OnInit, OnDestroy {
    @Input() currentPage: string | null = null;

    activeTitleBarMenu: number | null = null;
    titleBarMenus: TitleMenuItem[] = [];

    private isMacOS = false;
    private destroyed = false;
    private unsubscribeMenu?: () => void;
    private readonly electorrent = window.electorrent;

    constructor(
        @Inject("$rootScope") private readonly rootEvents: TitleBarRootEvents,
        @Inject("$bittorrent") private readonly bittorrent: TitleBarBittorrentService,
        @Inject("settingsService") private readonly settingsService: TitleBarSettingsService,
        private readonly zone: NgZone,
    ) {}

    ngOnInit(): void {
        this.unsubscribeMenu = this.electorrent.menu.onChanged((menu) => {
            this.zone.run(() => this.updateMenu(menu));
        });

        void this.electorrent.menu.getModel().then((menu) => {
            this.zone.run(() => this.updateMenu(menu));
        });
        void this.electorrent.app.getMeta().then((meta) => {
            if (!this.destroyed) {
                this.zone.run(() => {
                    this.isMacOS = meta.isMacOS;
                });
            }
        });
    }

    ngOnDestroy(): void {
        this.destroyed = true;
        this.unsubscribeMenu?.();
        this.unsubscribeMenu = undefined;
    }

    visibleTitleBarMenuItems(menu: TitleMenuItem): TitleMenuItem[] {
        return (menu.submenu || []).filter((item) => item.visible !== false);
    }

    formatTitleMenuAccelerator(accelerator?: string): string | undefined {
        if (!accelerator) {
            return accelerator;
        }

        if (!this.isMacOS) {
            return accelerator
                .replace("CmdOrCtrl", "Ctrl")
                .replace("Command", "Ctrl")
                .replace("Cmd", "Ctrl");
        }

        const macModifiers: Record<string, string> = {
            CmdOrCtrl: "⌘",
            Command: "⌘",
            Cmd: "⌘",
            Ctrl: "⌃",
            Control: "⌃",
            Alt: "⌥",
            Option: "⌥",
            Shift: "⇧",
            Delete: "⌫",
            Backspace: "⌫",
        };
        return accelerator.split("+").map((key) => macModifiers[key] || key).join("");
    }

    toggleTitleBarMenu(index: number, event: Event): void {
        event.stopPropagation();
        this.activeTitleBarMenu = this.activeTitleBarMenu === index ? null : index;
    }

    openTitleBarMenu(index: number): void {
        if (this.activeTitleBarMenu !== null) {
            this.activeTitleBarMenu = index;
        }
    }

    closeTitleBarMenu(): void {
        this.activeTitleBarMenu = null;
    }

    runTitleBarMenuItem(item: TitleMenuItem, event: Event): void {
        event.stopPropagation();
        if (item.type === "separator" || item.enabled === false || !item.action) {
            return;
        }

        this.activeTitleBarMenu = null;
        this.runTitleBarAction(item.action);
    }

    @HostListener("document:click")
    closeOnDocumentClick(): void {
        this.closeTitleBarMenu();
    }

    @HostListener("document:keydown", ["$event"])
    closeOnEscape(event: KeyboardEvent): void {
        if (event.key === "Escape") {
            this.closeTitleBarMenu();
        }
    }

    private updateMenu(menu: TitleMenuItem[]): void {
        if (!this.destroyed) {
            this.titleBarMenus = menu;
        }
    }

    private runTitleBarAction(action: TitleMenuAction): void {
        switch (action.type) {
            case "quit":
                this.electorrent.app.quit();
                break;
            case "edit-command":
                this.electorrent.edit.command(action.command);
                break;
            case "window-command":
                this.electorrent.window.command(action.command);
                break;
            default:
                this.runMenuAction(action);
                break;
        }
    }

    private runMenuAction(action: MenuAction): void {
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
                const activeTextInput = this.getActiveTextInput();
                if (activeTextInput) {
                    activeTextInput.select();
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
                void this.electorrent.torrents.openFiles(!!action.askUploadOptions).then((files) => {
                    files.forEach((file) => this.broadcastTorrentFile(file, !!file.askUploadOptions));
                });
                break;
            case "paste-torrent-url":
                this.bittorrent.uploadFromClipboard(!!action.askUploadOptions);
                break;
            case "open-external":
                this.electorrent.shell.openExternal(action.url);
                break;
            case "check-for-updates":
                this.electorrent.updates.check(!!action.verbose);
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

    private getActiveTextInput(): HTMLInputElement | HTMLTextAreaElement | null {
        return document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
            ? document.activeElement
            : null;
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
}
