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
            return $scope.torrent.statusColor();
        }

        $scope.label = function(){
            var label = $scope.torrent.statusText();
            if ($scope.torrent.isStatusDownloading()){
                label += (" " + $scope.torrent.getPercentStr());
            }
            return label;
        }
    }

    function link(scope, element /*, attrs*/ ) {

        scope.$watch(function() {
            return scope.torrent;
        }, function(torrent) {
            element.find('.bar').css('width', torrent.getPercentStr());
        });
    }

});
