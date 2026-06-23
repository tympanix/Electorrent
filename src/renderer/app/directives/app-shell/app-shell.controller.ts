import { IScope } from "angular";
import { PendingTorrentUploadFile, PendingTorrentUploadLink } from "@renderer/app/directives/add-torrent-modal/add-torrent-modal.directive";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import type { AppMeta, EditCommand, LaunchPayload, MenuAction, WindowCommand } from "@shared/ipc-contract";

type TitleBarMenuAction =
    | MenuAction
    | { type: "quit" }
    | { type: "edit-command"; command: EditCommand }
    | { type: "window-command"; command: WindowCommand };

interface TitleBarMenuItem {
    label: string;
    accelerator?: string;
    separator?: boolean;
    checked?: boolean;
    enabled?: boolean;
    visible?: () => boolean;
    action?: TitleBarMenuAction;
}

interface TitleBarMenu {
    label: string;
    items: () => TitleBarMenuItem[];
}

interface AppShellScope extends IScope {
    servers: any[];
    connectedServerName: () => string;
    showSyncConnectionIndicator: () => boolean;
    syncConnectionState: () => string;
    syncConnectionMessage: () => string;
    showTorrents: boolean;
    showLoading: boolean;
    statusText: string;
    connectToServer: (server: any) => void;
    showSettings: () => boolean;
    showWelcome: () => boolean;
    showServers: () => boolean;
    isWindows: boolean;
    activeTitleBarMenu: number | null;
    titleBarMenus: TitleBarMenu[];
    visibleTitleBarMenuItems: (menu: TitleBarMenu) => TitleBarMenuItem[];
    toggleTitleBarMenu: (index: number, $event: Event) => void;
    openTitleBarMenu: (index: number) => void;
    closeTitleBarMenu: () => void;
    runTitleBarMenuItem: (item: TitleBarMenuItem, $event: Event) => void;
    [key: string]: any;
}

export class AppShellController {
    static $inject = ["$rootScope", "$scope", "$timeout", "$bittorrent", "settingsService", "notificationService"];

    constructor(
        $rootScope: ElectorrentRootScope,
        $scope: AppShellScope,
        $timeout: angular.ITimeoutService,
        $bittorrent: any,
        settingsService: any,
        $notify: any,
    ) {
        const electorrent = window.electorrent
        const MAX_LOADING_TIME = 10000;

        const PAGE_SETTINGS = "settings";
        const PAGE_WELCOME = "welcome";
        const PAGE_SERVERS = "servers";
        const PAGE_TORRENTS = "torrents";

        let loadingTimer: angular.IPromise<void> | undefined;
        let page: string | null = null;
        let pendingMagnets: Array<PendingTorrentUploadLink & { askUploadOptions?: boolean }> = [];
        let pendingTorrentFiles: Array<PendingTorrentUploadFile & { askUploadOptions?: boolean }> = [];
        let isDebug = false;

        const getActiveTextInput = () => {
            return document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement
                ? document.activeElement
                : null;
        };

        const supportsUploadOptions = () => {
            return Object.values($rootScope.$btclient?.features.uploadOptions || {}).some(Boolean);
        };

        const hasActiveServer = () => {
            return !!$rootScope.$server?.id;
        };

        const serverAccelerator = (index: number) => {
            return index > 0 && index <= 10 ? `Ctrl+${index % 10}` : undefined;
        };

        const getServerLabel = (server: any) => {
            if (typeof server?.getDisplayName === "function") {
                return server.getDisplayName();
            }

            return server?.name || server?.ip || "Server";
        };

        const handleMenuAction = (action: MenuAction) => {
            switch (action.type) {
                case "show-settings":
                    $scope.$emit("show:settings");
                    break;
                case "show-servers":
                    $scope.$emit("show:servers");
                    break;
                case "search-torrent":
                    $rootScope.$broadcast("search:torrent");
                    break;
                case "select-all":
                    {
                        const activeTextInput = getActiveTextInput();
                        if (activeTextInput) {
                            activeTextInput.select();
                        } else if (page === PAGE_TORRENTS) {
                            $scope.$broadcast("select:torrents");
                        }
                    }
                    break;
                case "remove-selected":
                    if (document.activeElement?.nodeName !== "INPUT" && page === PAGE_TORRENTS) {
                        $scope.$broadcast("remove:torrents");
                    }
                    break;
                case "open-add-torrent":
                    electorrent.torrents.openFiles(!!action.askUploadOptions).then((files: Array<PendingTorrentUploadFile & { askUploadOptions?: boolean }>) => {
                        files.forEach((item) => broadcastTorrentFile(item, !!item.askUploadOptions));
                    });
                    break;
                case "paste-torrent-url":
                    $bittorrent.uploadFromClipboard(!!action.askUploadOptions);
                    break;
                case "open-external":
                    electorrent.shell.openExternal(action.url);
                    break;
                case "check-for-updates":
                    electorrent.updates.check(!!action.verbose);
                    break;
                case "connect-server":
                    {
                        const server = settingsService.getServer(action.serverId);
                        if (server) {
                            connectToServer(server);
                        }
                    }
                    break;
                case "set-current-default-server":
                    settingsService.setCurrentServerAsDefault();
                    break;
                case "add-server":
                    $scope.$emit("add:server");
                    break;
                default:
                    break;
            }
            $scope.$applyAsync();
        };

        const runTitleBarAction = (action: TitleBarMenuAction) => {
            switch (action.type) {
                case "quit":
                    electorrent.app.quit();
                    break;
                case "edit-command":
                    electorrent.edit.command(action.command);
                    break;
                case "window-command":
                    electorrent.window.command(action.command);
                    break;
                default:
                    handleMenuAction(action);
                    break;
            }
        };

        const fileMenuItems = (): TitleBarMenuItem[] => [
            {
                label: "Add Torrent",
                accelerator: "Ctrl+O",
                action: { type: "open-add-torrent", askUploadOptions: false },
            },
            {
                label: "Add Torrent (Advanced)",
                accelerator: "Ctrl+Shift+O",
                visible: supportsUploadOptions,
                action: { type: "open-add-torrent", askUploadOptions: true },
            },
            {
                label: "Paste Torrent URL",
                accelerator: "Ctrl+I",
                action: { type: "paste-torrent-url", askUploadOptions: false },
            },
            {
                label: "Paste Torrent URL (Advanced)",
                accelerator: "Ctrl+Shift+I",
                visible: supportsUploadOptions,
                action: { type: "paste-torrent-url", askUploadOptions: true },
            },
            { label: "", separator: true },
            {
                label: "Settings",
                accelerator: "Ctrl+,",
                action: { type: "show-settings" },
            },
            { label: "", separator: true },
            {
                label: "Exit",
                action: { type: "quit" },
            },
        ];

        const editMenuItems = (): TitleBarMenuItem[] => [
            { label: "Undo", accelerator: "Ctrl+Z", action: { type: "edit-command", command: "undo" } },
            { label: "Redo", accelerator: "Shift+Ctrl+Z", action: { type: "edit-command", command: "redo" } },
            { label: "", separator: true },
            { label: "Find", accelerator: "Ctrl+F", action: { type: "search-torrent" } },
            { label: "Cut", accelerator: "Ctrl+X", action: { type: "edit-command", command: "cut" } },
            { label: "Copy", accelerator: "Ctrl+C", action: { type: "edit-command", command: "copy" } },
            { label: "Paste", accelerator: "Ctrl+V", action: { type: "edit-command", command: "paste" } },
            { label: "Remove", accelerator: "Delete", action: { type: "remove-selected" } },
            { label: "Select All", accelerator: "Ctrl+A", action: { type: "select-all" } },
        ];

        const viewMenuItems = (): TitleBarMenuItem[] => [
            {
                label: "Reload",
                accelerator: "Ctrl+R",
                visible: () => isDebug,
                action: { type: "window-command", command: "reload" },
            },
            {
                label: "Toggle Full Screen",
                accelerator: "F11",
                action: { type: "window-command", command: "toggle-full-screen" },
            },
            {
                label: "Toggle Developer Tools",
                accelerator: "Ctrl+Shift+I",
                visible: () => isDebug,
                action: { type: "window-command", command: "toggle-dev-tools" },
            },
        ];

        const serverMenuItems = (): TitleBarMenuItem[] => {
            const items: TitleBarMenuItem[] = [
                { label: "Add new server...", accelerator: "Ctrl+N", action: { type: "add-server" } },
                {
                    label: "Set current as default",
                    enabled: hasActiveServer(),
                    action: { type: "set-current-default-server" },
                },
                { label: "", separator: true },
            ];

            if (!hasActiveServer()) {
                items.push({ label: "Disabled...", enabled: false });
                return items;
            }

            $scope.servers.forEach((server, index) => {
                items.push({
                    label: getServerLabel(server),
                    accelerator: serverAccelerator(index + 1),
                    checked: server.id === $rootScope.$server?.id,
                    action: { type: "connect-server", serverId: server.id },
                });
            });

            return items;
        };

        const windowMenuItems = (): TitleBarMenuItem[] => [
            {
                label: "Minimize",
                accelerator: "Ctrl+M",
                action: { type: "window-command", command: "minimize" },
            },
            {
                label: "Close",
                accelerator: "Ctrl+W",
                action: { type: "window-command", command: "close" },
            },
        ];

        const helpMenuItems = (): TitleBarMenuItem[] => [
            {
                label: "Learn More",
                action: { type: "open-external", url: "https://github.com/tympanix/Electorrent" },
            },
            {
                label: "Check For Updates",
                action: { type: "check-for-updates", verbose: true },
            },
        ];

        $scope.servers = settingsService.getServers();
        $scope.connectedServerName = () => $rootScope.$server?.getDisplayName() || "";
        $scope.syncConnectionState = () => $rootScope.$syncConnection?.state || "normal";
        $scope.showSyncConnectionIndicator = () => $scope.syncConnectionState() !== "normal";
        $scope.syncConnectionMessage = () => {
            if ($scope.syncConnectionState() === "broken") {
                return "Connection lost. Trying to reconnect.";
            }
            return "Server response is slower than usual.";
        };
        $scope.showTorrents = false;
        $scope.showLoading = true;
        $scope.statusText = "Loading";
        $scope.isWindows = false;
        $scope.activeTitleBarMenu = null;
        $scope.titleBarMenus = [
            { label: "File", items: fileMenuItems },
            { label: "Edit", items: editMenuItems },
            { label: "View", items: viewMenuItems },
            { label: "Servers", items: serverMenuItems },
            { label: "Window", items: windowMenuItems },
            { label: "Help", items: helpMenuItems },
        ];
        $scope.visibleTitleBarMenuItems = (menu: TitleBarMenu) => {
            return menu.items().filter((item) => item.visible ? item.visible() : true);
        };
        $scope.toggleTitleBarMenu = (index: number, $event: Event) => {
            $event.stopPropagation();
            $scope.activeTitleBarMenu = $scope.activeTitleBarMenu === index ? null : index;
        };
        $scope.openTitleBarMenu = (index: number) => {
            if ($scope.activeTitleBarMenu !== null) {
                $scope.activeTitleBarMenu = index;
            }
        };
        $scope.closeTitleBarMenu = () => {
            $scope.activeTitleBarMenu = null;
        };
        $scope.runTitleBarMenuItem = (item: TitleBarMenuItem, $event: Event) => {
            $event.stopPropagation();
            if (item.separator || item.enabled === false || !item.action) {
                return;
            }

            $scope.activeTitleBarMenu = null;
            runTitleBarAction(item.action);
        };

        const onDocumentClick = () => {
            $scope.closeTitleBarMenu();
            $scope.$applyAsync();
        };
        const onDocumentKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                $scope.closeTitleBarMenu();
                $scope.$applyAsync();
            }
        };
        document.addEventListener("click", onDocumentClick);
        document.addEventListener("keydown", onDocumentKeyDown);
        $scope.$on("$destroy", () => {
            document.removeEventListener("click", onDocumentClick);
            document.removeEventListener("keydown", onDocumentKeyDown);
        });

        $rootScope.$on("ready", () => {
            Promise.all([settingsService.whenReady(), electorrent.app.getMeta()]).then(([_, meta]: [unknown, AppMeta]) => {
                $scope.isWindows = meta.isWindows;
                isDebug = meta.isDebug;
                const settings = settingsService.getAllSettings();
                const automaticUpdates = settings?.automaticUpdates;
                if (!meta.isDebug && automaticUpdates !== false) {
                    electorrent.updates.check();
                }

                if (!settings.servers.length) {
                    pageWelcome();
                    return;
                }

                if (settings.startup === "default") {
                    const server = settingsService.getDefaultServer();
                    if (server) {
                        connectToServer(server);
                    } else {
                        pageServers();
                        $notify.ok("No default server", "Please choose a server to connect to");
                    }
                } else if (settings.startup === "latest") {
                    const server = settingsService.getRecentServer();
                    if (server) {
                        connectToServer(server);
                    } else {
                        pageServers();
                        $notify.ok("No recent servers", "Please choose a server to connect to");
                    }
                } else {
                    pageServers();
                }
            }).finally(() => {
                $scope.$applyAsync();
            });
        });

        $scope.$on("menu:selectall", () => {
            if (page === PAGE_TORRENTS) {
                $scope.$broadcast("select:torrents");
            }
        });

        $scope.$on("menu:remove", () => {
            if (page === PAGE_TORRENTS) {
                $scope.$broadcast("remove:torrents");
            }
        });

        $scope.connectToServer = (server: any) => {
            connectToServer(server);
        };

        const queueMagnetLinks = (magnets: PendingTorrentUploadLink[], askUploadOptions = false) => {
            pendingMagnets.push(...magnets.map((link) => ({
                ...link,
                askUploadOptions: link.askUploadOptions ?? askUploadOptions,
            })));
        };

        const queueTorrentFiles = (files: Array<PendingTorrentUploadFile & { askUploadOptions?: boolean }>) => {
            pendingTorrentFiles.push(...files);
        };

        const broadcastTorrentFile = (file: PendingTorrentUploadFile, askUploadOptions: boolean) => {
            const pendingFile: PendingTorrentUploadFile = {
                type: "file",
                data: new Uint8Array(file.data),
                filename: file.filename,
                metadata: file.metadata,
                sourcePath: file.sourcePath,
            };
            $scope.$broadcast("torrents:add", pendingFile, askUploadOptions);
        };

        const broadcastTorrentLink = (link: PendingTorrentUploadLink, askUploadOptions: boolean) => {
            $scope.$broadcast("torrents:add", {
                type: "link",
                uri: link.uri,
                metadata: link.metadata,
            }, askUploadOptions);
        };

        const drainPendingLaunchPayloads = () => {
            if (!$rootScope.$btclient || !$rootScope.$server?.isConnected) {
                return;
            }

            pendingMagnets.splice(0).forEach((magnet) => {
                broadcastTorrentLink(magnet, !!magnet.askUploadOptions);
            });

            pendingTorrentFiles.splice(0).forEach((file) => {
                broadcastTorrentFile(file, !!file.askUploadOptions);
            });
        };

        electorrent.launch.onMagnets((magnets: PendingTorrentUploadLink[]) => {
            queueMagnetLinks(magnets);
            drainPendingLaunchPayloads();
            $scope.$applyAsync();
        });

        electorrent.launch.onTorrentFiles((files: Array<PendingTorrentUploadFile & { askUploadOptions?: boolean }>) => {
            queueTorrentFiles(files);
            drainPendingLaunchPayloads();
            $scope.$applyAsync();
        });

        electorrent.menu.onAction((action: MenuAction) => {
            handleMenuAction(action);
        });

        const pageTorrents = (fullupdate?: boolean) => {
            $scope.showTorrents = true;
            $scope.$broadcast("start:torrents", fullupdate);
            page = PAGE_TORRENTS;
        };

        const pageLoading = () => {
            $scope.showLoading = true;
        };

        const pageSettings = (settingsPage?: string, serverId?: string) => {
            $scope.$broadcast("setting:load", serverId);
            $scope.showLoading = false;
            if (settingsPage) {
                $scope.$broadcast("settings:page", settingsPage, true);
            }
            page = PAGE_SETTINGS;
        };

        const pageServers = () => {
            $scope.showLoading = false;
            $scope.showTorrents = false;
            page = PAGE_SERVERS;
        };

        const pageWelcome = () => {
            $scope.showLoading = false;
            page = PAGE_WELCOME;
        };

        const connectToServer = (server: any) => {
            pageLoading();
            $scope.$broadcast("stop:torrents");
            $scope.$broadcast("wipe:torrents");
            $rootScope.$btclient = null;
            $rootScope.$server = null;
            const serverName = typeof server?.getDisplayName === "function"
                ? server.getDisplayName()
                : (server?.name || server?.ip || "server");
            $scope.statusText = "Connecting to " + serverName;

            server.connect().then(() => {
                $scope.statusText = "Loading Torrents";
                settingsService.updateServer(server);
                pageTorrents(true);
                return electorrent.launch.getPending().then((payload: LaunchPayload) => {
                    queueMagnetLinks(payload.magnets || []);
                    queueTorrentFiles(payload.torrentFiles || []);
                    drainPendingLaunchPayloads();
                });
            }).catch((err: unknown) => {
                console.error(err);
                pageSettings("connection", server.id);
            }).then(() => {
                $scope.$apply();
            });
        };

        $scope.$on("add:server", () => {
            $scope.$broadcast("stop:torrents");
            $rootScope.$btclient = null;
            pageWelcome();
            $scope.$apply();
        });

        $scope.$on("connect:server", (event: unknown, server: any) => {
            connectToServer(server);
        });

        $scope.$on("show:settings", () => {
            if (page === PAGE_WELCOME || page === PAGE_SERVERS) {
                return;
            }
            $scope.$broadcast("setting:load");
            page = PAGE_SETTINGS;
            $scope.$applyAsync();
        });

        $scope.$on("show:servers", () => {
            pageServers();
        });

        $scope.$on("hide:loading", () => {
            if (loadingTimer) {
                $timeout.cancel(loadingTimer);
            }
            $scope.showLoading = false;
        });

        $scope.$on("show:welcome", () => {
            page = PAGE_WELCOME;
            $scope.$apply();
        });

        $scope.$on("show:torrents", () => {
            pageTorrents();
        });

        $scope.$on("emit:new:settings", (event: unknown, data: unknown) => {
            $scope.$broadcast("new:settings", data);
        });

        $scope.$on("loading", (event: unknown, message: string) => {
            $scope.statusText = message;
            $scope.showLoading = true;

            loadingTimer = $timeout(() => {
                $scope.showLoading = false;
                $notify.alert("Loading took too long", "There seems to be something wrong with loading");
            }, MAX_LOADING_TIME);
        });

        $scope.showSettings = () => page === PAGE_SETTINGS;
        $scope.showWelcome = () => page === PAGE_WELCOME;
        $scope.showServers = () => page === PAGE_SERVERS;
    }
}
