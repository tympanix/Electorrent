import moment from "moment"

export let dateFilter = function() {
    const BT_EPOCH = 994032000000 /* July 2nd 2001, release of bittorrent */
    return function(epochtime) {
        if (!epochtime) return ''
        if (epochtime < BT_EPOCH) return ''
        return moment(epochtime).fromNow();
    }
};

export let etaFilter = function() {

    var MONTH_IN_SECONDS = 60*60*24*30

    return function(seconds) {
        if (!seconds || seconds < 1 || seconds > MONTH_IN_SECONDS) return ''
        return moment().to(moment().add(seconds, 'seconds'), true)
    };
};

export let releaseDateFilter = function() {
    return function(date) {
        if (!date){
            return "Release date unknown"
        }
        return moment(date, moment.ISO_8601).format("MMMM Do YYYY, HH:mm");
    }
}

angular.module("torrentApp").filter('epoch', function() {
    return function(epoch) {
        if (!epoch) {
            return 'Unknown date'
        }
        return moment(epoch*1000).format("MMMM Do YYYY, HH:mm");
    }
})
