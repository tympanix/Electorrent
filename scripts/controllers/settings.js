angular.module("torrentApp").controller("settingsController", ["$scope", "utorrentService", "configService", "notificationService", "electron", function($scope, $utorrentService, config, $notify, electron) {

    $scope.connecting = false;
    $scope.page = 'general';

    loadAllSettings();

    function loadAllSettings() {
        $scope.server = config.getServer()
        $scope.general = {
            magnets: electron.app.isDefaultProtocolClient('magnet')
        }
    }

    function subscribeToMagnets() {
        if ($scope.general.magnets) {
            console.log("Set handler!");
            electron.app.setAsDefaultProtocolClient('magnet');
        } else {
            console.log("Remove handler!");
            electron.app.removeAsDefaultProtocolClient('magnet');
        }
    }

    $scope.$on('show:settings', function() {
        console.info("Update settings!")
        loadAllSettings();
    })

    function writeSettings() {
        saveServer();
        subscribeToMagnets();
    }

    function saveServer() {
        config.saveServer($scope.server)
            .then(function() {
                $scope.close();
            })
            .catch(function(err) {
                console.error('Oh noes', err);
            })
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

        $utorrentService.connect(ip, port, user, password)
            .then(function() {
                writeSettings();
                $scope.connecting = false;
            })
            .catch(function(err) {
                console.error("Oh noes!", err);
                $scope.connecting = false;
                $notify.alert("Connection Problem", "Oh noes! We could not connect to the server");
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

}]);
