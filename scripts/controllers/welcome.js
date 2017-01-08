angular.module("torrentApp").controller("welcomeController", ["$scope", "$timeout", "$bittorrent", "$btclients", "electron", "configService", "notificationService", "Server", function ($scope, $timeout, $bittorrent, $btclients, electron, config, $notify, Server) {

    $scope.connecting = false;
    $scope.btclients = $btclients;

    console.log("Welcome parent scope", $scope.$parent)

    function clearForm() {
        $scope.ip = ''
        $scope.port = ''
        $scope.username = ''
        $scope.password = ''
        $scope.client = undefined
    }

    $scope.connect = function() {

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

        $scope.connecting = true;

        btclient.connect(ip, port, user, password).then(function() {
            $timeout(function(){
                $bittorrent.setClient(btclient);
                saveServer(ip, port, user, password, client);
            }, 500)
        }).catch(function(err) {
            $timeout(function(){
                console.error(err);
            }, 500)
        }).finally(function() {
            $scope.connecting = false;
        })
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
