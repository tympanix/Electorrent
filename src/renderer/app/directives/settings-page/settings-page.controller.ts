export class SettingsPageController {
    static $inject = ["$rootScope", "$scope", "$injector", "$q", "$bittorrent", "$btclients", "configService", "notificationService", "electron"];

    constructor(
        $rootScope: angular.IRootScopeService & { $server?: any },
        $scope: any,
        $injector: angular.auto.IInjectorService,
        $q: angular.IQService,
        $bittorrent: any,
        $btclients: any,
        config: any,
        $notify: any,
        electron: any,
    ) {
        let serverCopy: any;

        $scope.settings = {};
        $scope.server = {};
        $scope.themes = electron.themes();
        $scope.btclients = $btclients;
        $scope.is = electron.is;
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
        $scope.appVersion = electron.app.getVersion();
        $scope.nodeVersion = process.versions.node;
        $scope.chromeVersion = process.versions.chrome;
        $scope.electronVersion = process.versions.electron;
        $scope.connecting = false;
        $scope.page = "general";
        $scope.layoutSortOptions = {
            handle: ".sort.handle",
            "ui-floating": true,
        };

        loadAllSettings();

        function loadAllSettings() {
            $scope.settings = config.getAllSettingsCopy();
            loadServerReference();

            serverCopy = angular.copy($scope.server);

            $scope.general = {
                magnets: electron.app.isDefaultProtocolClient("magnet"),
            };
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
                electron.app.setAsDefaultProtocolClient("magnet");
            } else {
                electron.app.removeAsDefaultProtocolClient("magnet");
            }
        }

        $scope.$on("setting:load", () => {
            console.info("Loading settings");
            loadAllSettings();
        });

        function writeSettings() {
            return config.saveAllSettings($scope.settings)
                .then(() => {
                    subscribeToMagnets();
                }).catch((err: unknown) => {
                    $notify.alert("Settings could not be saved", err);
                    return $q.reject(err);
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
            config.updateApplicationMenu();
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
                return config.updateServer($scope.server);
            });
        }

        $scope.save = () => {
            $scope.$emit("loading", "Applying Settings");

            $q.when().then(() => {
                return saveServer();
            }).then(() => {
                return writeSettings();
            }).then(() => {
                $scope.close();
                config.updateApplicationMenu();
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
