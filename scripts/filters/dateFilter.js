angular.module("torrentApp").filter('date', function() {
    return function(epochtime) {
        if (epochtime === '') return ''
        return moment(epochtime).fromNow();
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
