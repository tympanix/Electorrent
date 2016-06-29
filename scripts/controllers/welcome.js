angular.module("torrentApp").controller("welcomeController", ["$scope", "$timeout", "utorrentService", "electron", "configService", "notificationService", function ($scope, $timeout, $utorrentService, electron, config, $notify) {

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
                $notify.ok("Success!", "Hooray! Welcome to Electorrent")
            }, 500)
        }).catch(function(err) {
            $timeout(function(){
                console.error(err);
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
