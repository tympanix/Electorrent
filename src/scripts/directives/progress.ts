export let progress = ['$timeout', function($timeout) {
    return {
        scope: {
            torrent: '=progress',
        },
        restrict: 'A',
        template: `<div class="ui torrent progress" ng-class="class()">
            <label>{{label()}}</label>
            <div class="bar idle"></div>
        </div>`,
        replace: true,
        link: link
    };


    function link(scope, element /*, attrs*/ ) {
        var idle = true
        var bar = element.find('.bar')

        function updateProgress(newPercent?, oldPercent?) {
            if (scope.torrent.percent < 1000 || oldPercent < 1000) {
                bar.css('width', scope.torrent.getPercentStr());
                if (idle) {
                    $timeout(function() {
                        bar.removeClass('idle')
                        idle = false
                    })
                }
            }
        }

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
        }, function(newPercent, oldPercent) {
            if (newPercent !== oldPercent) {
                updateProgress(newPercent, oldPercent)
            }
        });

        updateProgress()
    }

}];
