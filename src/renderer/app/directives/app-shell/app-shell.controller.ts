import { IRootScopeService, IScope } from "angular";
import { PendingTorrentUploadFile } from "../add-torrent-modal/add-torrent-modal.directive";
import type { AppMeta, LaunchPayload, MenuAction } from "../../../../shared/ipc-contract";

interface AppShellScope extends IScope {
    servers: any[];
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
    static $inject = ["$rootScope", "$scope", "$timeout", "$bittorrent", "configService", "notificationService"];

    constructor(
        $rootScope: IRootScopeService & { $btclient?: any; $server?: any },
        $scope: AppShellScope,
        $timeout: angular.ITimeoutService,
        $bittorrent: any,
        config: any,
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
        let pendingMagnets: string[] = [];
        let pendingTorrentFiles: Array<PendingTorrentUploadFile & { askUploadOptions?: boolean }> = [];

        $scope.servers = config.getServers();
        $scope.showTorrents = false;
        $scope.showLoading = true;
        $scope.statusText = "Loading";

        $rootScope.$on("ready", () => {
            Promise.all([config.whenReady(), electorrent.app.getMeta()]).then(([_, meta]: [unknown, AppMeta]) => {
                const settings = config.getAllSettings();
                const automaticUpdates = settings?.automaticUpdates;
                if (!meta.isDebug && automaticUpdates !== false) {
                    electorrent.updates.check();
                }

                if (!settings.servers.length) {
                    pageWelcome();
                    return;
                }

                if (settings.startup === "default") {
                    const server = config.getDefaultServer();
                    if (server) {
                        connectToServer(server);
                    } else {
                        pageServers();
                        $notify.ok("No default server", "Please choose a server to connect to");
                    }
                } else if (settings.startup === "latest") {
                    const server = config.getRecentServer();
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

        const queueMagnetLinks = (magnets: string[]) => {
            pendingMagnets.push(...magnets);
        };

        const queueTorrentFiles = (files: Array<PendingTorrentUploadFile & { askUploadOptions?: boolean }>) => {
            pendingTorrentFiles.push(...files);
        };

        const broadcastTorrentFile = (file: PendingTorrentUploadFile, askUploadOptions: boolean) => {
            const pendingFile: PendingTorrentUploadFile = {
                type: "file",
                data: new Uint8Array(file.data),
                filename: file.filename,
            };
            $scope.$broadcast("torrents:add", pendingFile, askUploadOptions);
        };

        const drainPendingLaunchPayloads = () => {
            if (!$rootScope.$btclient) {
                return;
            }

            pendingMagnets.splice(0).forEach((magnet) => {
                $rootScope.$btclient?.addTorrentUrl(magnet);
            });

            pendingTorrentFiles.splice(0).forEach((file) => {
                broadcastTorrentFile(file, !!file.askUploadOptions);
            });
        };

        electorrent.launch.onMagnets((magnets: string[]) => {
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
                        const server = config.getServer(action.serverId);
                        if (server) {
                            connectToServer(server);
                        }
                    }
                    break;
                case "set-current-default-server":
                    config.setCurrentServerAsDefault();
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

        const pageSettings = (settingsPage?: string) => {
            $scope.$broadcast("setting:load");
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
            $bittorrent.setServer(server);
            $scope.statusText = "Connecting to " + $rootScope.$btclient?.name;

            server.connect().then(() => {
                $scope.statusText = "Loading Torrents";
                config.updateServer(server);
                pageTorrents(true);
                return electorrent.launch.getPending().then((payload: LaunchPayload) => {
                    queueMagnetLinks(payload.magnets || []);
                    queueTorrentFiles(payload.torrentFiles || []);
                    drainPendingLaunchPayloads();
                });
            }).catch((err: unknown) => {
                console.error(err);
                pageSettings("connection");
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
            $scope.$apply();
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
