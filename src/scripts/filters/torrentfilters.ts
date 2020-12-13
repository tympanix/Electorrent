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
            return parseFloat(ratio).toFixed(2)
        } else {
            return ''
        }
    }
});

angular.module("torrentApp").filter('torrentTracker', function() {
    const URL_REGEX = /^[a-z]+:\/\/(?:[a-z0-9-]+\.)*((?:[a-z0-9-]+\.)[a-z]+)/

    return function(tracker) {
        if (!tracker) return ''
        var match = tracker.match(URL_REGEX)
        if (!match) return ''
        return match[1]
    }
});
