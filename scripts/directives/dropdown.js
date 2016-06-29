angular.module("torrentApp").directive('dropdown', ['$document', '$window', function($document, $window) {
    return {
        restrict: 'A',
        link: link
    }

    function link(scope, element, attr){

        $(element).dropdown();

        scope[attr.bind] = {
            clear: doAction(element, 'clear'),
            refresh: doAction(element, 'refresh'),
            setSelected: doAction(element, 'set selected'),
            getValue: doAction(element, 'get value')
        };

    }

    function doAction(element, action){
        return function(param) {
            $(element).dropdown(action, param);
        }
    }

}]);
