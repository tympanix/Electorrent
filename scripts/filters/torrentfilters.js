angular.module("torrentApp").filter('torrentQueue', function() {
    return function(queue) {
        if (Number.isInteger(queue) && queue >= 0) {
            return queue
        } else {
            return ''
        }
    };
});
