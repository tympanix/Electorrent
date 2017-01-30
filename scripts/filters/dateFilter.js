angular.module("torrentApp").filter('date', function() {
    return function(epochtime) {
        if (epochtime === '') return ''
        return moment(epochtime).fromNow();
    };
});

angular.module("torrentApp").filter('eta', function() {

    var MONTH_IN_SECONDS = 60*60*24*30

    return function(seconds) {
        if (seconds < 1) return ''
        if (seconds > MONTH_IN_SECONDS) return ''
        return moment().to(moment().add(seconds, 'seconds'), true)
    };
});

angular.module("torrentApp").filter('releaseDate', function() {
    return function(date) {
        if (!date){
            return "Release date unknown"
        }
        return moment(date, moment.ISO_8601).format("MMMM Do YYYY, HH:mm");
    }
})
