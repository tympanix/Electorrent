angular.module("torrentApp").directive('resizeable', ["$timeout", function($timeout) {
    return {
        restrict: 'A',
        link: link
    };

    function link(scope, element /*, attr*/){
        $timeout(function(){
            $(element).colResizable({
                liveDrag: true,
                minWidth: 25
            });
        }, 100);
    }

}]);
