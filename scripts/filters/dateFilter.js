angular.module("torrentApp").filter('date', function() {
        return function(epochtime) {
            return moment(epochtime).fromNow();
        };
    });
