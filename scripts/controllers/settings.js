angular.module("torrentApp").controller("settingsController", ["$rootScope", "$scope", "$injector", "$bittorrent", "$btclients", "configService", "notificationService", "electron", function($rootScope, $scope, $injector, $bittorrent, $btclients, config, $notify, electron) {

    // External Settings reference
    $scope.settings = {
        server: {
            ip: '',
            port: '',
            user: '',
            password: '',
            type: '',
        },
        ui: {
            resizeMode: ''
        }
    };

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

    function loadAllSettings() {
        $scope.settings = config.getAllSettings();

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
            })
            .catch(function(err) {
                $notify.alert("Settings could not be saved", err)
            })
        subscribeToMagnets();
    }

    $scope.close = function() {
        $scope.$emit('show:torrents');
        loadAllSettings();
    }

    $scope.save = function() {
        $scope.connecting = true;
        var ip = $scope.settings.server.ip;
        var port = $scope.settings.server.port;
        var user = $scope.settings.server.user;
        var password = $scope.settings.server.password;
        var client = $scope.settings.server.type;

        var btclient = $bittorrent.getClient(client);

        btclient.connect(ip, port, user, password)
            .then(function() {
                writeSettings();
                $bittorrent.setClient(btclient);
                $rootScope.$broadcast('new:settings', $scope.settings)
                //$scope.$emit('emit:new:settings', $scope.settings)
                $scope.connecting = false;
            })
            .catch(function(err) {
                console.error("Oh noes!", err);
                $scope.connecting = false;
            })
    }

    $scope.activeOn = function(page) {
        var value = '';
        if ($scope.page === page) value = 'active';
        return value;
    }

    $scope.gotoPage = function(page) {
        $scope.page = page;
    }

    $scope.$on('settings:page', function(event, page){
        $scope.gotoPage(page);
    })

}]);
