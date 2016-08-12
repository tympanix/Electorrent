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
    electron.ipc.on('autoUpdate', function(event, data){
        $scope.manualUpdate = false;

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

    // Listen for manual updates from the main process
    electron.ipc.on('manualUpdate', function(event, data){
        $scope.updateData = data
        $scope.manualUpdate = true;

        $timeout(function(){
            $('#updateModal').modal('show');
        }, 500)
    });

    $scope.installUpdate = function() {
        console.log("Install and update!");
        if ($scope.manualUpdate){
            electron.updater.manualQuitAndUpdate();
            //electron.ipc.send('startUpdate', null);
        } else {
            electron.autoUpdater.quitAndInstall();
        }

    }

}]);
