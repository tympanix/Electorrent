import angular from "angular"

angular.module("torrentApp").directive('ngRightClick', function($parse) {
    function link(scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        element.bind('contextmenu', function(event) {
            scope.$apply(function() {
                event.preventDefault();
                fn(scope, {$event:event});
            });
        });
    };
    return {
        link: link
    }
});
