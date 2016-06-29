angular.module("torrentApp").directive('dropdown', [function() {
    return {
        restrict: 'A',
        link: link
    }

    function link(scope, element, attr){

        $(element).dropdown({
            transition: "vertical flip",
            duration: 100
        });

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
