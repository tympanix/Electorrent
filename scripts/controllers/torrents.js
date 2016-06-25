angular.module("torrentApp").controller("torrentsController", ["$scope", "$interval", "$filter", "$log", "utorrentService", function ($scope, $interval, $filter, $log, $utorrentService) {
    var ut = $utorrentService;
    var selected = [];
    var lastSelected = null;

    ut.init().then(function(){
        $scope.update();
    });

    $scope.torrents = {};
    $scope.arrayTorrents = [];
    $scope.contextMenu = null;

    $scope.filters = {
        status: 'downloading'
    }

    $scope.download = function(){
        ut.addTorrentUrl("magnet:?xt=urn:btih:B8E6C2551CD060F1D31657C11787DF9F65AE5A13&dn=orange+is+the+new+black+s04e01+webrip+xvid+mp3+rarbg&tr=udp%3A%2F%2Ftracker.publicbt.com%2Fannounce&tr=udp%3A%2F%2Fglotorrents.pw%3A6969%2Fannounce&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80%2Fannounce&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce");
    };

    $scope.filterByStatus = function(status){
        deselectAll();
        lastSelected = null;
        $scope.filters.status = status;
        refreshTorrents();
    }

    $scope.showContextMenu = function(event, torrent, index) {
        if (!torrent.selected){
            singleSelect(torrent);
        }
        $scope.contextMenu.show(event);
        console.info("Right click context menu!");
    };

    $scope.numInFilter = function(status) {
        var num = 0;
        angular.forEach($scope.torrents, function(torrent, hash) {
            if (statusFilter(torrent, status)) num++;
        });
        return num;
    }

    $scope.noneSelected = function(){
        return selected.length === 0;
    }

    function toggleSelect(torrent){
        if (!torrent.selected){
            selected.push(torrent);
        } else {
            selected = selected.filter(function(item){
                return item.hash !== torrent.hash;
            });
        }
        torrent.selected = !torrent.selected;
        lastSelected = torrent;
    }

    function deselectAll(){
        for (var i = 0; i < selected.length; i++){
            selected[i].selected = false;
        }
        selected = [];
    }

    function singleSelect(torrent){
        deselectAll();
        torrent.selected = true;
        selected.push(torrent);
        lastSelected = torrent;
    }

    function multiSelect(index){
        var lastIndex = $scope.arrayTorrents.indexOf(lastSelected);
        if (lastIndex < 0) return;

        var i, j;
        if (lastIndex < index){
            i = lastIndex;
            j = index;
        } else {
            i = index;
            j = lastIndex;
        }

        deselectAll();
        while (i<=j){
            $scope.arrayTorrents[i].selected = true;
            selected.push($scope.arrayTorrents[i]);
            i++;
        }
    }

    $scope.setSelected = function(event, torrent, index) {
        if (event.ctrlKey || event.metaKey){
            toggleSelect(torrent);
        } else if (event.shiftKey){
            multiSelect(index);
        } else {
            singleSelect(torrent);
        }
        console.log("Selected", selected);
    }

    $scope.update = function() {
        ut.torrents().then(function(torrents){
            newTorrents(torrents);
            deleteTorrents(torrents);
            changeTorrents(torrents);
        });
    };

    function getSelectedHashes(){
        var hashes = [];
        angular.forEach(selected, function(torrent){
            hashes.push(torrent.hash)
        })
        return hashes;
    }

    $scope.doAction = function(action) {
        var call = ut.actions()[action];
        if (call){
            call({ hash: getSelectedHashes()}).$promise
            .then(function(){
                console.log("Action " + action + " performed!");
                $scope.update();
            })
        } else {
            console.error("Action " + action + " not allowed");
        }
    };

    $scope.doContextAction = function(action) {
        $scope.contextMenu.hide();
        $scope.doAction(action);
    }

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
        };
    }

    function statusFilter(torrent, status) {
        switch (status) {
            case 'finished': return torrent.isStatusCompleted();
            case 'downloading': return torrent.isStatusDownloading();
            case 'paused': return torrent.isStatusPaused();
            case 'queued': return torrent.isStatusQueued();
            case 'seeding': return torrent.isStatusSeeding();
            case 'error': return torrent.isStatusError();
        }
    }

    function torrentFilter(){
        return function(torrent){
            if ($scope.filters.status) {
                return statusFilter(torrent, $scope.filters.status);
            }
        }
    }

    function refreshTorrents(){
        var torrents = fetchTorrents();
        torrents = torrents.filter(torrentFilter());
        torrents = torrents.sort(torrentSorter());
        $scope.arrayTorrents = torrents;
        //console.log("Torrents", torrents);
    }

    function newTorrents(torrents){
        if (torrents.all && torrents.all.length > 0) {
            for (var i = 0; i < torrents.all.length; i++){
                var torrent = ut.build(torrents.all[i]);
                $scope.torrents[torrent.hash] = torrent;
            }
            refreshTorrents()
        }
    }

    function deleteTorrents(torrents){
        if (torrents.deleted && torrents.deleted.length > 0) {
            for (var i = 0; i < torrents.deleted.length; i++) {
                delete $scope.torrents[torrents.deleted[i]];
            }
            refreshTorrents();
        }
    }

    function changeTorrents(torrents){
        if (torrents.changed && torrents.changed.length > 0) {
            for (var i = 0; i < torrents.changed.length; i++) {
                var torrent = ut.build(torrents.changed[i]);
                if ($scope.torrents[torrent.hash].selected){
                    torrent.selected = true;
                }
                $scope.torrents[torrent.hash] = torrent;
            }
            refreshTorrents()
        }
    }

    $interval(function(){
        $scope.update();
    }, 2000);

}])
