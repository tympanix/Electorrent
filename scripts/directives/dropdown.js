angular.module("torrentApp").directive('dropdown', ['$document', '$window', function($document, $window) {
    return {
        restrict: 'A',
        link: link
    }

    function link(scope, element){
        $(element).dropdown({ on: 'hover' });
    }

}]);
