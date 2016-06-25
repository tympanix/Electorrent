angular.module("torrentApp").controller("welcomeController", ["$scope", "$timeout", "utorrentService", "electron", "configService", function ($scope, $timeout, $utorrentService, electron, config) {

    $scope.connecting = false;

    $scope.connect = function() {
        $scope.connecting = true;

        var ip = $scope.ip || '';
        var port = $scope.port || '';
        var user = $scope.username || '';
        var password = $scope.password || '';

        $utorrentService.connect(ip, port, user, password).then(function() {
            $timeout(function(){
                saveServer(ip, port, user, password);
            }, 500)
        }).catch(function() {
            $timeout(function(){
                $scope.connecting = false;
            }, 500)
        })
    }

    function saveServer(ip, port, username, password){
        config.saveServer(ip, port, username, password)
        .then(function(){
            $scope.$emit('show:torrents');
        })
        .catch(function(){
            $scope.connecting = false;
        })
    }

}]);
