angular.module("torrentApp").controller("notificationsController", ["$scope", "$rootScope", function($scope, $rootScope) {

    $scope.notifications = [];

    $scope.close = function(index){
        $scope.notifications.splice(index, 1);
    }

    $rootScope.$on('notification', function(event, data){
        $scope.notifications.push(data);
        console.info("Got notification!", data);
    })

}]);
