import { IScope } from "angular";
import { PendingTorrentUploadFile, PendingTorrentUploadLink } from "@renderer/app/directives/add-torrent-modal/add-torrent-modal.directive";
import type { ElectorrentRootScope } from "@renderer/app/types/root-scope";
import type { AppMeta, LaunchPayload, MenuAction } from "@shared/ipc-contract";

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

        $rootScope.$on("ready", () => {
            Promise.all([settingsService.whenReady(), electorrent.app.getMeta()]).then(([_, meta]: [unknown, AppMeta]) => {
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
                    if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) {
                        document.activeElement.select();
                    } else if (page === PAGE_TORRENTS) {
                        $scope.$broadcast("select:torrents");
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
