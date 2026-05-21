import type { AppMeta, ThemeInfo } from "@shared/ipc-contract";

export class SettingsPageController {
    static $inject = ["$rootScope", "$scope", "$injector", "$bittorrent", "$btclients", "settingsService", "notificationService"];

    constructor(
        $rootScope: angular.IRootScopeService & { $server?: any },
        $scope: any,
        $injector: angular.auto.IInjectorService,
        $bittorrent: any,
        $btclients: any,
        settingsService: any,
        $notify: any,
    ) {
        const electorrent = window.electorrent
        let serverCopy: any;
        let loadPromise: Promise<void> | undefined;

        $scope.settings = {};
        $scope.server = {};
        $scope.themes = [];
        $scope.btclients = $btclients;
        $scope.is = {
            macOS: () => false,
            windows: () => false,
            linux: () => false,
        };
        $scope.general = {
            magnet: false,
        };
        $scope.renameData = {
            server: undefined,
            name: "",
            reset() {
                this.name = this.server.getNameAtAddress();
            },
        };
        $scope.appVersion = "";
        $scope.nodeVersion = "";
        $scope.chromeVersion = "";
        $scope.electronVersion = "";
        $scope.connecting = false;
        $scope.page = "general";
        $scope.layoutSortOptions = {
            handle: ".sort.handle",
            "ui-floating": true,
        };

        loadPromise = Promise.all([
            Promise.resolve(settingsService.whenReady()),
            electorrent.settings.listThemes(),
            electorrent.app.getMeta(),
        ]).then(([_settingsReady, themes, meta]: [unknown, ThemeInfo[], AppMeta]) => {
            $scope.themes = themes;
            $scope.appVersion = meta.appVersion;
            $scope.nodeVersion = meta.versions.node;
            $scope.chromeVersion = meta.versions.chrome;
            $scope.electronVersion = meta.versions.electron;
            $scope.is = {
                macOS: () => meta.isMacOS,
                windows: () => meta.isWindows,
                linux: () => meta.isLinux,
            };
            return loadAllSettings();
        }).finally(() => {
            $scope.$applyAsync();
        });

        function loadAllSettings() {
            $scope.settings = settingsService.getAllSettingsCopy();
            loadServerReference();

            serverCopy = angular.copy($scope.server);

            return electorrent.app.getDefaultProtocolStatus("magnet").then((magnets: boolean) => {
                $scope.general = {
                    magnets: magnets,
                };
            });
        }

        function loadServerReference() {
            if ($rootScope.$server) {
                $scope.server = $scope.settings.servers.find((server: any) => {
                    return server.id === $rootScope.$server?.id;
                });
            }
        }

        function subscribeToMagnets() {
            if ($scope.general.magnets) {
                return electorrent.app.setDefaultProtocolStatus("magnet", true);
            } else {
                return electorrent.app.setDefaultProtocolStatus("magnet", false);
            }
        }

        $scope.$on("setting:load", () => {
            Promise.resolve(loadPromise).then(() => loadAllSettings()).finally(() => {
                $scope.$applyAsync();
            });
        });

        function writeSettings() {
            return settingsService.saveAllSettings($scope.settings)
                .then(() => {
                    return subscribeToMagnets();
                }).catch((err: unknown) => {
                    $notify.alert("Settings could not be saved", err);
                    throw err;
                });
        }

        $scope.setPath = () => {
            if ($scope.pathPristine) {
                $scope.server.setPath();
            }
        };

        $scope.openRenameModal = (server: any) => {
            $scope.renameData.server = server;
            $scope.renameData.name = server.getDisplayName();
            const modal: any = $("#renameModal");
            modal.modal("show");
        };

        $scope.renameServer = () => {
            if (!$scope.renameData.name) {
                return false;
            }
            $scope.renameData.server.name = $scope.renameData.name;
            return true;
        };

        $scope.moveServerUp = (server: any) => {
            const index = $scope.settings.servers.indexOf(server);
            if (index && index > 0) {
                const previous = $scope.settings.servers[index - 1];
                $scope.settings.servers[index - 1] = server;
                $scope.settings.servers[index] = previous;
            }
        };

        $scope.resetPath = () => {
            $scope.server.setPath();
            $scope.pathPristine = true;
        };

        $scope.lockPath = () => {
            $scope.pathPristine = false;
        };

        $scope.close = () => {
            if ($scope.server.isConnected) {
                $scope.$emit("show:torrents");
                loadAllSettings();
            } else {
                $scope.$emit("show:servers");
            }
        };

        function saveServer() {
            if ($scope.server.equals(serverCopy) && $scope.server.isConnected) {
                return;
            }
            serverCopy = angular.copy($scope.server);
            $scope.connecting = true;
            return $scope.server.connect().then(() => {
                return settingsService.updateServer($scope.server);
            });
        }

        $scope.save = () => {
            $scope.$emit("loading", "Applying Settings");

            Promise.resolve().then(() => {
                return saveServer();
            }).then(() => {
                return writeSettings();
            }).then(() => {
                $scope.close();
                $rootScope.$broadcast("new:settings", $scope.settings);
                $notify.ok("Saved Settings", "Your settings have been updated");
            }).catch((err: unknown) => {
                $scope.$emit("hide:loading");
                console.error("Settings Error", err);
            }).finally(() => {
                $scope.connecting = false;
            });
        };

        $scope.activeOn = (page: string) => {
            return $scope.page === page ? "active" : "";
        };

        $scope.toggleDefaultServer = (server: any) => {
            if (server.default === true) {
                $scope.settings.servers.forEach((_server: any) => {
                    if (server !== _server) {
                        _server.default = false;
                    }
                });
            }
        };

        $scope.removeServer = (server: any) => {
            if ($rootScope.$server?.id === server.id) {
                $notify.alert("Server in use", "Can't remove a server that is currently being used");
            } else {
                $scope.settings.servers = $scope.settings.servers.filter((item: any) => {
                    return item.id !== server.id;
                });
            }
        };

        $scope.gotoPage = (page: string) => {
            $scope.page = page;
        };

        $scope.$on("settings:page", (event: unknown, page: string, force: boolean) => {
            $scope.force = force || false;
            $scope.gotoPage(page);
        });
    }
}
