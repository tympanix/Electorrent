angular.module("torrentApp").directive('progress', function() {
    return {
        scope: {
            progress: '=',
        },
        restrict: 'A',
        link: link
    };

    function link(scope, element, attrs) {
        var torrent = scope.progress;
        element.find('.bar').css('width', torrent.percent/10 + '%')
        element.find('label').html(torrent.statusMessage);

        scope.$watch(function() {return torrent.percent; }, function(newValue){
            console.log("Percent changed", newValue);
            element.find('.bar').css('width', torrent.percent/10 + '%');
            element.find('label').html(torrent.statusMessage);
            if (torrent.isStatusDownloading()){
                element.find('label').append(' ' + torrent.percent/10 + '%')
            }
        });
    }

});
