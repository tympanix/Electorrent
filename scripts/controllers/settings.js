angular.module("torrentApp").controller("settingsController", ["$scope", "$interval", "$filter", "$log", "utorrentService", function ($scope, $interval, $filter, $log, $utorrentService) {
    var ut = $utorrentService;
    $scope.hello = "Hello settings world!";


    $scope.close = function(){
        $scope.$emit('show:torrents');
    }
}]);
