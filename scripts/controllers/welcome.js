angular.module("torrentApp").controller("welcomeController", ["$scope", "$timeout", "$bittorrent", "$btclients", "electron", "configService", "notificationService", function ($scope, $timeout, $bittorrent, $btclients, electron, config, $notify) {

    $scope.connecting = false;
    $scope.btclients = $btclients;

    $scope.connect = function() {
        $scope.connecting = true;

        var ip = $scope.ip || '';
        var port = $scope.port || '';
        var user = $scope.username || '';
        var password = $scope.password || '';
        var client = $scope.client || '';

        var btclient = $bittorrent.getClient(client);

        if (!btclient) {
            $notify.alert("Opps!", "Please select a client to connect to!")
            $scope.connecting = false;
            return;
        }

        btclient.connect(ip, port, user, password).then(function() {
            $timeout(function(){
                $bittorrent.setClient(btclient);
                saveServer(ip, port, user, password, client);
            }, 500)
        }).catch(function(err) {
            $timeout(function(){
                console.error(err);
                $scope.connecting = false;
            }, 500)
        })
    }

    function saveServer(ip, port, username, password, client){
        config.saveServer(ip, port, username, password, client)
        .then(function(){
            $scope.$emit('show:torrents');
            $notify.ok("Success!", "Hooray! Welcome to Electorrent")
        })
        .catch(function(){
            $scope.connecting = false;
            $notify.alert("Oops!", "Could not save settings?!")
        })
    }

}]);
