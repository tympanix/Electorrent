angular.module("torrentApp").directive('progress', function() {
    return {
        scope: {
            percent: '=',
        },
        restrict: 'A',
        link: link
    };

    function link(scope, element, attrs) {
        $(element).progress();

        scope.$watch(function() {return scope.percent; }, function(newValue){
            console.log("Percent changed", newValue);
            $(element).progress({
                percent: newValue
            });
        });
    }

});
