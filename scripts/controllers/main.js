angular.module("torrentApp").controller("mainController", ["$scope", "utorrentService", "electron", function ($scope, $utorrentService, electron) {
    var ut = $utorrentService;
    $scope.hello = "Hello settings world!";

    var page = null;

    electron.config.get('first', function(err, data){
        if (err){
            page = 'welcome';
            $scope.$apply();
        }
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

}]);
