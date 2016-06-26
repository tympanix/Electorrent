angular.module("torrentApp").directive('readyBroadcast', ['$rootScope', '$timeout', function($rootScope, $timeout) {
    return {
        restrict: 'A',
        link: link
    };

    function link(/*scope, element, attr*/){
        $timeout(function(){
            $rootScope.$emit('ready');
        });
    }

}]);
