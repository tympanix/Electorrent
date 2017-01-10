angular.module("torrentApp").controller("settingsController", ["$rootScope", "$scope", "$injector", "$bittorrent", "$btclients", "configService", "notificationService", "electron", function($rootScope, $scope, $injector, $bittorrent, $btclients, config, $notify, electron) {

    // External Settings reference
    $scope.settings = {};

    $scope.server = {}

    $scope.btclients = $btclients;

    // Internal settings reference
    $scope.general = {
        magnet: false
    }

    $scope.appVersion = electron.app.getVersion()
    $scope.nodeVersion = process.versions.node;
    $scope.chromeVersion = process.versions.chrome;
    $scope.electronVersion = process.versions.electron;

    $scope.connecting = false;
    $scope.page = 'general';

    loadAllSettings();

    // $scope.$watch(function() {
    //     return $scope.settings
    // });

    function loadAllSettings() {
        $scope.settings = config.getAllSettings();
        $scope.server = $bittorrent.getServer();

        $scope.general = {
            magnets: electron.app.isDefaultProtocolClient('magnet')
        }
    }

    function subscribeToMagnets() {
        if ($scope.general.magnets) {
            electron.app.setAsDefaultProtocolClient('magnet');
        } else {
            electron.app.removeAsDefaultProtocolClient('magnet');
        }
    }

    $scope.$on('show:settings', function() {
        loadAllSettings();
    })

    function writeSettings() {
        config.saveAllSettings($scope.settings)
            .then(function() {
                $scope.close();
                $notify.ok("Saved Settings", "You settings has been updated")
            }).catch(function(err) {
                $notify.alert("Settings could not be saved", err)
            })
        config.updateServer($scope.server)
            .then(function() {
                $bittorrent.setServer($scope.server)
            }).catch(function() {
                $notify.alert("Settings error", "Could not save new server")
            })
        subscribeToMagnets();
    }

    $scope.close = function() {
        $scope.$emit('show:torrents');
        loadAllSettings();
    }

    $scope.save = function() {
        $scope.connecting = true;
        var ip = $scope.server.ip;
        var port = $scope.server.port;
        var user = $scope.server.user;
        var password = $scope.server.password;
        var client = $scope.server.client;

        var btclient = $bittorrent.getClient(client);

        btclient.connect(ip, port, user, password)
            .then(function() {
                writeSettings();

                $bittorrent.setClient(btclient);
                $rootScope.$broadcast('new:settings', $scope.settings)
            }).catch(function(err) {
                console.error("Oh noes!", err);
            }).finally(function() {
                $scope.connecting = false;
            })
    }

    $scope.activeOn = function(page) {
        var value = '';
        if ($scope.page === page) value = 'active';
        return value;
    }

    $scope.toggleDefaultServer = function(server) {
        if (server.default === true) {
            config.setDefault(server, true /* Skip saving */)
        }
        console.log("Toggle default server", server);
    }

    $scope.removeServer = function(server) {
        if ($rootScope.$server === server) {
            $notify.alert('Server in use', 'Can\'t remove a server that is currently being used')
        } else {
            config.removeServer(server)
        }
    }

    $scope.gotoPage = function(page) {
        $scope.page = page;
    }

    $scope.$on('settings:page', function(event, page){
        $scope.gotoPage(page);
    })

}]);
