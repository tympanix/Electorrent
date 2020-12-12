angular.module("torrentApp").controller("welcomeController", ["$scope", "$timeout", "$bittorrent", "$btclients", "electron", "configService", "notificationService", "Server", function ($scope, $timeout, $bittorrent, $btclients, electron, config, $notify, Server) {

    $scope.connecting = false;
    $scope.btclients = $btclients;
    $scope.server = new Server()
    $scope.advanced = false

    function clearForm() {
        $scope.server = new Server()
    }

    $scope.connect = function() {
        $scope.connecting = true;

        $scope.server.connect().then(function() {
            return config.saveServer($scope.server)
        }).then(function(){
            $scope.$emit('connect:server', $scope.server)
            clearForm()
            $notify.ok("Success!", "Hooray! Welcome to Electorrent")
        }).catch(function(err) {
            console.error(err);
        }).finally(function() {
            $scope.connecting = false;
        })
    }

    $scope.setPath = function() {
        console.log("Set path")
        if ($scope.server.client) {
            $scope.server.setPath()
        }
    }

    function saveServer(ip, port, username, password, client){
        let server = new Server(ip, port, username, password, client)

        $bittorrent.setServer(server)

        config.saveServer(server).then(function(){
            $scope.$emit('show:torrents');
            clearForm()
            $notify.ok("Success!", "Hooray! Welcome to Electorrent")
        }).catch(function(){
            $notify.alert("Oops!", "Could not save settings?!")
        })
    }

}]);
