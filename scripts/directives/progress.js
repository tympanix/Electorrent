angular.module("torrentApp").directive('progress', function() {
    return {
        scope: {
            torrent: '=',
        },
        restrict: 'E',
        template: `<div class="ui torrent progress" ng-class="class()" progress="torrent">
            <label>{{label()}}</label>
            <div class="bar"></div>
        </div>`,
        controller: controller,
        replace: true,
        link: link
    };

    function controller($scope){

        $scope.class = function(){
            if ($scope.torrent.isStatusPaused()){
                return 'grey';
            } else if ($scope.torrent.isStatusSeeding()){
                return 'orange';
            } else if ($scope.torrent.isStatusDownloading()){
                return 'blue';
            } else if ($scope.torrent.isStatusError()){
                return 'error';
            } else if ($scope.torrent.isStatusCompleted()){
                return 'success';
            } else {
                return 'disabled';
            }
        }

        $scope.label = function(){
            const statusRegex = /[^a-zA-Z ]/g;
            var label = $scope.torrent.statusMessage.replace(statusRegex, '');
            if ($scope.torrent.isStatusDownloading()){
                label += (" " + $scope.torrent.getPercentStr());
            }
            return label;
        }
    }

    function link(scope, element /*, attrs*/ ) {
        var torrent = scope.torrent;
        // element.find('.bar').css('width', torrent.percent / 10 + '%')
        // element.find('label').html(torrent.statusMessage);
        //
        scope.$watch(function() {
            return torrent.percent;
        }, function() {
            element.find('.bar').css('width', torrent.getPercentStr());
        });
    }

});
