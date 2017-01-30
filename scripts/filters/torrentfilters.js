angular.module("torrentApp").filter('torrentQueue', function() {
    return function(queue) {
        if (Number.isInteger(queue) && queue >= 0) {
            return queue
        } else {
            return ''
        }
    };
});

angular.module("torrentApp").filter('torrentRatio', function() {
    function isNumeric(number) {
        return !isNaN(parseFloat(number)) && isFinite(number);
    }

    return function(ratio) {
        if (isNumeric(ratio)) {
            return ratio.toFixed(2)
        } else {
            return ''
        }
    }
});
