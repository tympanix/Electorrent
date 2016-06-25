angular.module("torrentApp").controller("mainController", ["$scope", "utorrentService", "electron", "configService", function ($scope, $utorrentService, electron, config) {
    var ut = $utorrentService;
    var showTorrents = false;
    var page = null;

    config.getServer().then(function(){
        // TODO: Try to connect to server
        showTorrents = true;
    }).catch(function(){
        // First time starting application
        page = 'welcome';
    })

    $scope.$on('show:settings', function(event, data) {
        page = 'settings';
        $scope.$apply();
    })

    $scope.$on('show:welcome', function() {
        page = 'welcome';
        $scope.$apply();
    })

    $scope.$on('show:torrents', function(){
        page = null;
    })

    $scope.showSettings = function(){
        return page === 'settings';
    }

    $scope.showWelcome = function() {
        return page === 'welcome';
    }

    $scope.showTorrents = function() {
        return showTorrents;
    }

}]);
