import { IRootScopeService, IScope } from "angular";
import { PendingTorrentUploadFile } from "../add-torrent-modal/add-torrent-modal.directive";

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
    static $inject = ["$rootScope", "$scope", "$timeout", "$bittorrent", "electron", "configService", "notificationService"];

    constructor(
        $rootScope: IRootScopeService & { $btclient?: any; $server?: any },
        $scope: AppShellScope,
        $timeout: angular.ITimeoutService,
        $bittorrent: any,
        electron: any,
        config: any,
        $notify: any,
    ) {
        const MAX_LOADING_TIME = 10000;

        const PAGE_SETTINGS = "settings";
        const PAGE_WELCOME = "welcome";
        const PAGE_SERVERS = "servers";
        const PAGE_TORRENTS = "torrents";

        let loadingTimer: angular.IPromise<void> | undefined;
        let settings = config.getAllSettings();
        let page: string | null = null;

        $scope.servers = config.getServers();
        $scope.showTorrents = false;
        $scope.showLoading = true;
        $scope.statusText = "Loading";

        $rootScope.$on("ready", () => {
            const automaticUpdates = config.getAllSettings()?.automaticUpdates;
            if (!electron.program.debug && automaticUpdates !== false) {
                electron.updater.checkForUpdates();
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

        const requestMagnetLinks = () => {
            electron.ipc.send("send:magnets");
        };

        const requestTorrentFiles = () => {
            electron.ipc.send("send:torrentfiles");
        };

        electron.ipc.on("magnet", (event: unknown, data: string[]) => {
            data.forEach((magnet) => {
                $rootScope.$btclient?.addTorrentUrl(magnet);
            });
        });

        electron.ipc.on("torrentfiles", (event: unknown, buffer: ArrayLike<any>, filename: string, askUploadOptions: boolean) => {
            const data = new Uint8Array(buffer);
            const file: PendingTorrentUploadFile = {
                type: "file",
                data,
                filename,
            };
            $scope.$broadcast("torrents:add", file, askUploadOptions);
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
                requestMagnetLinks();
                requestTorrentFiles();
            }).catch((err: unknown) => {
                console.error(err);
                pageSettings("connection");
            }).then(() => {
                config.updateApplicationMenu();
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
