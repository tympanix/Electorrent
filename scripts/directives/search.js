angular.module("torrentApp").directive('search', ['$rootScope', '$document', function($rootScope, $document) {
    return {
        restrict: 'A',
        link: link
    };


    function link(scope, element /*, attrs*/ ) {
        $rootScope.$on('search:torrent', () => {
            element.focus()
        });
    }

}]);
