angular.module("torrentApp").controller("mainController", ["$scope", "utorrentService", function ($scope, $utorrentService) {
    var ut = $utorrentService;

    ut.init();

    $scope.torrents = {};

    $scope.name = "Mathias";

    $scope.download = function(){
        ut.addTorrentUrl("magnet:?xt=urn:btih:ce8357ded670f06329f6028d2f2cea6f514646e0&dn=Zootopia+2016+1080p+HDRip+x264+AC3-JYK&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=udp%3A%2F%2Fopen.demonii.com%3A1337&tr=udp%3A%2F%2Ftracker.coppersurfer.tk%3A6969&tr=udp%3A%2F%2Fexodus.desync.com%3A6969");
    }

    $scope.list = function() {
        var newTorrents = {};
        ut.torrents().then(function(torrents){
            for (i = 0; i < torrents.all.length; i++){
                var torrent = ut.build(torrents.all[i])
                newTorrents[torrent.hash] = torrent;
            }
            $scope.torrents = newTorrents;
            console.log($scope.torrents);
        })
    };

}])
