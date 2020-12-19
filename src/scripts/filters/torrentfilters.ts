export let torrentQueueFilter = function() {
    return function(queue) {
        if (Number.isInteger(queue) && queue >= 0) {
            return queue
        } else {
            return ''
        }
    };
};

export let torrentRatioFilter = function() {
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
};

export let torrentTrackerFilter = function() {
    const URL_REGEX = /^[a-z]+:\/\/(?:[a-z0-9-]+\.)*((?:[a-z0-9-]+\.)[a-z]+)/

    return function(tracker) {
        if (!tracker) return ''
        var match = tracker.match(URL_REGEX)
        if (!match) return ''
        return match[1]
    }
};
