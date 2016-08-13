angular.module("torrentApp").controller("settingsController", ["$scope", "utorrentService", "configService", "notificationService", "electron", function($scope, $utorrentService, config, $notify, electron) {

    // External Settings reference
    $scope.settings = {
        server: {
            ip: '',
            port: '',
            user: '',
            password: ''
        },
        ui: {
            resizeMode: ''
        }
    };

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
        // $scope.server = config.getServer()

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

        $utorrentService.connect(ip, port, user, password)
            .then(function() {
                writeSettings();
                $scope.$emit('emit:new:settings', $scope.settings)
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
        console.log("Settings page", page, event);
        $scope.gotoPage(page);
    })

}]);
