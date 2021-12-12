
export let repeatDone = ['$timeout', function($timeout) {
    return function(scope, element, attrs) {
        if (scope.$last) {
            $timeout(function() {
                let callback = scope.$eval(attrs.repeatDone);
                if (angular.isFunction(callback)) callback()
            }, 0)
        }
    }
}];

