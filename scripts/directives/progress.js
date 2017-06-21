angular.module("torrentApp").directive('progress', function() {
    return {
        scope: {
            torrent: '=progress',
        },
        restrict: 'A',
        template: `<div class="ui torrent progress" ng-class="class()">
            <label>{{label()}}</label>
            <div class="bar"></div>
        </div>`,
        replace: true,
        link: link
    };


    function link(scope, element /*, attrs*/ ) {

        scope.class = function(){
            return scope.torrent.statusColor();
        }

        scope.label = function(){
            var label = scope.torrent.statusText();
            if (scope.torrent.isStatusDownloading()){
                label += (" " + scope.torrent.getPercentStr());
            }
            return label;
        }

        scope.$watch(function() {
            return scope.torrent.percent;
        }, function(torrent) {
            element.find('.bar').css('width', scope.torrent.getPercentStr());
        });
    }

});
