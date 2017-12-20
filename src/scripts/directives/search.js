angular.module("torrentApp").directive('search', ['$rootScope', '$document', function($rootScope, $document) {
    return {
        restrict: 'A',
        link: link
    };

    function link(scope, element /*, attrs*/ ) {
        element.on('keyup', function(event) {
            if (event.keyCode === 27 /* Escape key */){
                element.blur()
            }
        })

        $rootScope.$on('search:torrent', () => {
            element.focus()
            element.select()
        });
    }

}]);
