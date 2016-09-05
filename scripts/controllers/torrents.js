"use strict";

angular.module("torrentApp").controller("torrentsController", ["$rootScope", "$scope", "$timeout", "$filter", "$q", "$bittorrent", "notificationService", "configService", "AbstractTorrent", function ($rootScope, $scope, $timeout, $filter, $q, $bittorrent, $notify, config, AbstractTorrent) {
    const TIMEOUT = 2000;
    const LIMIT = 25;

    var selected = [];
    var lastSelected = null;
    var timeout;

    var settings = config.settings();

    $scope.torrents = {};
    $scope.arrayTorrents = [];
    $scope.contextMenu = null;
    $scope.showDragAndDrop = false;
    $scope.labelsDrowdown = null;
    $scope.torrentLimit = LIMIT;
    $scope.labels = [];
    $scope.resizeMode = settings.ui.resizeMode;
    $scope.client = $scope.$btclient;

    $scope.filters = {
        status: 'downloading'
    };

    $rootScope.$on('show:draganddrop', function(event, show) {
        $scope.showDragAndDrop = show;
        $scope.$apply();
    })

    $scope.$on('new:settings', function(event, data) {
        $scope.resizeMode = data.ui.resizeMode;
        resetAll();
    });

    $scope.showMore = function() {
        $scope.torrentLimit += LIMIT;
    };

    $scope.debug = function(){
        for (var i = 0; i < selected.length; i++){
            console.info(selected[i]);
        }
        return $q.when();
    };

    $scope.activeOn = function(filter) {
        if ($scope.filters.status === filter){
            return 'active';
        } else {
            return '';
        }
    }

    $scope.setLabel = function(label){
        $scope.$btclient.setLabel(getSelectedHashes(), label)
            .then(function() {
                $scope.update();
            })
            .catch(function() {
                $notify.alert("Could not set label", "The label could not be changes. Please go to settings and configure your connection");
            })
    }

    $scope.$on('start:torrents', function(){
        $scope.update();
        startTimer();
    });

    $scope.$on('show:settings', function(){
        stopTimer();
    });

    function startTimer(){
        timeout = $timeout(function(){
            //console.info("Update!");
            $scope.update().then(function(){
                startTimer();
            });
        }, TIMEOUT);
    }

    function resetAll() {
        $scope.torrents = {};
        $scope.arrayTorrents = [];
        $scope.labels = [];
        $scope.update(true);
    }

    function stopTimer(){
        console.info("Torrents stopped");
        $timeout.cancel(timeout);
    }

    $scope.filterByStatus = function(status){
        deselectAll();
        lastSelected = null;
        $scope.filters.status = status;
        $scope.torrentLimit = LIMIT;
        refreshTorrents();
    }

    $scope.filterByLabel = function(label){
        console.log("Filter by label", label);
        deselectAll();
        lastSelected = null;
        $scope.filters.label = label;
        $scope.torrentLimit = LIMIT;
        refreshTorrents();
    }

    $scope.activeLabel = function(label) {
        return $scope.filters.label === label;
    }

    $scope.showContextMenu = function(event, torrent /*, index*/) {
        if (!torrent.selected){
            singleSelect(torrent);
        }
        $scope.contextMenu.show(event);
    };

    $scope.numInFilter = function(status) {
        var num = 0;
        var filter = torrentFilter(status);

        angular.forEach($scope.torrents, function(torrent /*, hash*/) {
            if (filter(torrent)) {
                num++;
            }
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
        if (lastIndex < 0){
            return;
        }

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
        //$scope.labelsDrowdown.clear();
        if (event.ctrlKey || event.metaKey){
            toggleSelect(torrent);
        } else if (event.shiftKey){
            multiSelect(index);
        } else {
            singleSelect(torrent);
        }
        //console.log("Selected", selected);
    }

    $scope.update = function(fullupdate) {
        var q = $scope.$btclient.torrents(fullupdate)
        q.then(function(torrents){
            newTorrents(torrents);
            deleteTorrents(torrents);
            changeTorrents(torrents);
            updateLabels(torrents);
        });
        return q;
    };

    function getSelectedHashes(){
        var hashes = [];
        angular.forEach(selected, function(torrent){
            hashes.push(torrent.hash)
        })
        return hashes;
    }

    $scope.doAction = function(action, name, data) {
        action(selected, data)
            .then(function(){
                console.log("Action " + name + " performed!");
                $scope.update();
            })
            .catch(function(err) {
                $notify.alert("Invalid action", err);
            });
    };

    $scope.doContextAction = function(action, name) {
        action(selected)
        .then(function(){
            console.log("Action " + name + " performed!");
            $scope.update();
        })
        .catch(function(err) {
            $notify.alert("Invalid action", err);
        })
    }

    function fetchTorrents(){
        var results = [];
        angular.forEach($scope.torrents, function(torrent /*, hash*/) {
            results.push(torrent);
        });
        return results;
    }

    $scope.changeSorting = function(sortName, descending) {
        $scope.filters.sort = sortName;
        $scope.filters.order = descending;
        refreshTorrents();
    }

    function torrentSorter(){
        var sort = $scope.filters.sort || 'dateAdded';
        var desc = $scope.filters.order;

        var sorter = AbstractTorrent.sort(sort);

        var descSort = function(a, b) {
            return sorter(a[sort], b[sort]);
        }

        var ascSort = function(a, b) {
            return sorter(a[sort], b[sort]) * (-1);
        }

        if (desc) return descSort
        else return ascSort
    }

    function statusFilter(torrent, status) {
        switch (status) {
            case 'all': return true;
            case 'finished': return torrent.isStatusCompleted();
            case 'downloading': return torrent.isStatusDownloading() || torrent.isStatusPaused();
            case 'paused': return torrent.isStatusPaused();
            case 'queued': return torrent.isStatusQueued();
            case 'seeding': return torrent.isStatusSeeding();
            case 'error': return torrent.isStatusError();
            case 'stopped': return torrent.isStatusStopped();
        }
    }

    function torrentFilter(status, label){
        var filterStatus = status || $scope.filters.status;
        var filterLabel = label || $scope.filters.label;

        return function(torrent){
            var keep = [];

            if (filterStatus) {
                keep.push(statusFilter(torrent, filterStatus));
            }

            if (filterLabel) {
                keep.push(torrent.label === filterLabel)
            }

            return keep.every(function(shouldkeep) {
                return shouldkeep;
            });
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
                var torrent = torrents.all[i];
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
                var torrent = torrents.changed[i];
                var existing = $scope.torrents[torrent.hash];

                if (existing){
                    existing.update(torrent);
                } else {
                    $scope.torrents[torrent.hash] = torrent;
                }

            }
            refreshTorrents()
        }
    }

    function updateLabels(torrents){
        if (torrents.labels && torrents.labels.length > 0) {
            torrents.labels.forEach(function(label /*, index*/){
                if (!$scope.labels.includes(label)) {
                    $scope.labels.push(label)
                }
            })
        }
    }

}])
