angular.module("torrentApp").controller("notificationsController", ["$scope", "$rootScope", "$timeout", "electron", "$http", "notificationService", function($scope, $rootScope, $timeout, electron, $http, $notify) {

    var id = 0;

    $scope.updateData = {
        releaseDate: "Just now...",
        updateUrl: "http://www.update.this.app.com"
    };

    $scope.notifications = [];

    $scope.close = function(index){
        $scope.notifications.splice(index, 1);
    }

    $rootScope.$on('notification', function(event, data){
        id++;
        data.notificationId = id;
        $scope.notifications.push(data);
        removeAlert(data, data.delay || 3000);
    })

    function removeAlert(data, delay){
        $timeout(function(){
            $scope.notifications = $scope.notifications.filter(function(value){
                return value.notificationId !== data.notificationId;
            })
        }, delay);
    }

    // Listen for software update event from main process
    electron.ipc.on('update', function(event, data){
        $http.get(data.updateUrl, { timeout: 10000 })
            .success(function(releaseData){
                data.releaseNotes = releaseData.notes;
                data.releaseDate = releaseData.pub_date;
            })
            .catch(function(){
                data.releaseNotes = "Not available. Please go to the website for more info"
            })
            .then(function() {
                $scope.updateData = data
                $('#updateModal').modal('show');
            })
    })

    $scope.installUpdate = function() {
        console.log("Install and update!");
        electron.autoUpdater.quitAndInstall();
    }

}]);
