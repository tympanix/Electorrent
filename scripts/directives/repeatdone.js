angular.module("torrentApp").directive('repeatDone', [function() {
    return function(scope, element, attrs) {
        element.bind('$create', function(/*event*/) {
            if (scope.$first) {
                console.log("Repeat done!");
                scope.$eval(attrs.repeatDone);
            }
        });
    }
}]);
