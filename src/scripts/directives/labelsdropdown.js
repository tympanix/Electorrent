angular.module("torrentApp").directive('labelsDropdown', [function() {

    return {
        restrict: 'A',
        templateUrl: './views/misc/labels.html',
        scope: {
            enabled: '=?',
            action: '=',
            labels: '='
        }
    };

}]);
