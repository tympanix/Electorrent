angular.module("torrentApp").controller("settingsController", ["$scope", "utorrentService", "configService", function($scope, $utorrentService, config) {
    var ut = $utorrentService;
    $scope.hello = "Hello settings world!";

    $scope.connecting = false;
    $scope.page = 'connection';

    loadAllSettings();

    function loadAllSettings(){
        $scope.server = config.getServer()
    }

    $scope.$on('show:settings', function() {
        console.info("Update settings!")
        loadAllSettings();
    })

    function writeSettings() {
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
    }

    $scope.save = function() {
        $scope.connecting = true;
        var ip = $scope.server.ip;
        var port = $scope.server.port;
        var user = $scope.server.user;
        var password = $scope.server.password;

        $utorrentService.connect(ip, port, user, password)
            .then(function(data) {
                writeSettings();
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

}]);
