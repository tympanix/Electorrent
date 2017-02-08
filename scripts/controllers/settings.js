angular.module("torrentApp").controller("settingsController", ["$rootScope", "$scope", "$injector", "$q", "$bittorrent", "$btclients", "configService", "notificationService", "electron", function($rootScope, $scope, $injector, $q, $bittorrent, $btclients, config, $notify, electron) {

    let serverCopy

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

    $scope.layoutSortOptions = {
        handle: '.sort.handle',
        'ui-floating': true
    }

    loadAllSettings();

    function loadAllSettings() {
        $scope.settings = config.getAllSettings();
        $scope.server = $bittorrent.getServer();
        serverCopy = angular.copy($scope.server)

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

    $scope.$on('setting:load', function() {
        console.info("Loading settings");
        loadAllSettings();
    })

    function writeSettings() {
        return config.saveAllSettings($scope.settings)
        .then(function() {
            subscribeToMagnets();
        }).catch(function(err) {
            $notify.alert("Settings could not be saved", err)
            return $q.reject(err)
        })
    }

    $scope.close = function() {
        $scope.$emit('show:torrents');
        loadAllSettings();
    }

    function saveServer() {
        console.log("Force?", $scope.force);
        if ($scope.server.equals(serverCopy) && $scope.server.isConnected) return
        serverCopy = angular.copy($scope.server)
        $scope.connecting = true;
        console.log("Saving server");
        return $scope.server.connect().then(function() {
            return config.updateServer($scope.server)
        })
    }

    $scope.save = function() {
        $scope.$emit('loading', 'Applying Settings')
        console.log("Changes?", !$scope.server.equals(serverCopy));

        $q.when().then(function() {
            return saveServer()
        }).then(function() {
            console.log("Writing settings");
            return writeSettings()
        }).then(function() {
            $scope.close();
            $rootScope.$broadcast('new:settings', $scope.settings)
            $notify.ok("Saved Settings", "You settings has been updated")
        }).catch(function(err) {
            $scope.$emit('hide:loading')
            console.error("Settings Error", err);
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

    $scope.$on('settings:page', function(event, page, force){
        $scope.force = force || false
        $scope.gotoPage(page);
    })

}]);
