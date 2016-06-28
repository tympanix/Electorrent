angular.module("torrentApp").directive('checkbox', [function() {
    return {
        restrict: 'A',
        scope: {
            isChecked: '=',
            onCheck: '&',
            onUncheck: '&',
            bind: '='
        },
        link: link
    };

    function link(scope, element /*, attr*/){
        $(element).checkbox({
            onChecked: scope.onCheck,
            onUnchecked: scope.onUncheck,
            onChange: changeHandler(scope, element)
        });

        scope.$watch(function() {return scope.isChecked; }, function(newValue){
            if (newValue === true){
                $(element).checkbox('check');
            } else if (newValue === false){
                $(element).checkbox('uncheck');
            }
        });
    }

    function changeHandler(scope, element){
        return function(){
            if (scope.bind !== undefined){
                scope.bind = $(element).checkbox('is checked');
            }
        }
    }

}]);
