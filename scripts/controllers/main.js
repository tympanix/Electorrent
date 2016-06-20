angular.module("torrentApp").controller("mainController", ["$scope", "$interval", "$filter", "$log", "utorrentService", function ($scope, $interval, $filter, $log, $utorrentService) {
    var ut = $utorrentService;

    ut.init();

    $scope.torrents = {};
    $scope.arrayTorrents = [];

    $scope.filters = {
        status: 'downloading'
    }

    $scope.name = "Mathias";

    $scope.download = function(){
        ut.addTorrentUrl("magnet:?xt=urn:btih:B8E6C2551CD060F1D31657C11787DF9F65AE5A13&dn=orange+is+the+new+black+s04e01+webrip+xvid+mp3+rarbg&tr=udp%3A%2F%2Ftracker.publicbt.com%2Fannounce&tr=udp%3A%2F%2Fglotorrents.pw%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce");
    }

    $scope.filterByStatus = function(status){
        $scope.filters.status = status;
        refreshTorrents();
    }

    $scope.update = function() {
        ut.torrents().then(function(torrents){
            newTorrents(torrents)
            deleteTorrents(torrents)
            changeTorrents(torrents)
        });
    };

    function fetchTorrents(){
        var results = [];
        angular.forEach($scope.torrents, function(torrent, hash) {
            results.push(torrent);
        });
        return results;
    }

    function torrentSorter(){
        return function(a, b){
            return b.dateAdded - a.dateAdded;
        }
    }

    function torrentFilter(){
        return function(torrent){
            var matches = true;
            if ($scope.filters.status) {
                switch ($scope.filters.status) {
                    case 'finished':
                    {
                        matches = torrent.isStatusCompleted();
                        break;
                    }
                    case 'downloading':
                    {
                        matches = torrent.isStatusDownloading();
                        break;
                    }
                    case 'paused':
                    {
                        matches = torrent.isStatusPaused();
                        break;
                    }
                    case 'queued':
                    {
                        matches = torrent.isStatusQueued();
                        break;
                    }
                    case 'seeding':
                    {
                        matches = torrent.isStatusSeeding();
                        break;
                    }
                    case 'error':
                    {
                        matches = torrent.isStatusError();
                        break;
                    }
                }
            }
            return matches;
        }
    }

    function refreshTorrents(){
        var torrents = fetchTorrents();
        torrents = torrents.filter(torrentFilter());
        torrents = torrents.sort(torrentSorter());
        $scope.arrayTorrents = torrents;
        console.log("Torrents", torrents);
    }

    function newTorrents(torrents){
        if (torrents.all && torrents.all.length > 0) {
            for (i = 0; i < torrents.all.length; i++){
                var torrent = ut.build(torrents.all[i])
                $scope.torrents[torrent.hash] = torrent;
            }
            refreshTorrents()
        }
    }

    function deleteTorrents(torrents){
        if (torrents.deleted && torrents.deleted.length > 0) {
            $log.debug('"torrentm" key with ' + torrents.deleted.length + ' elements');
            for (i = 0; i < torrents.deleted.length; i++) {
                delete $scope.torrents[torrents.deleted[i]];
            }
            refreshTorrents()
        }
    }

    function changeTorrents(torrents){
        if (torrents.changed && torrents.changed.length > 0) {
            $log.debug('"torrentp" key with ' + torrents.changed.length + ' elements');
            for (i = 0; i < torrents.changed.length; i++) {
                var torrent = ut.build(torrents.changed[i]);
                $scope.torrents[torrent.hash] = torrent;
            }
            refreshTorrents()
        }
    }

    $interval(function(){
        $scope.update();
    }, 2000)

}])
