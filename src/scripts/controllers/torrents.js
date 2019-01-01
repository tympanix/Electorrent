"use strict";

angular.module("torrentApp").controller("torrentsController", ["$rootScope", "$scope", "$timeout", "$filter", "$q", "$bittorrent", "notificationService", "configService", "AbstractTorrent", function ($rootScope, $scope, $timeout, $filter, $q, $bittorrent, $notify, config, AbstractTorrent) {
    const LIMIT = 25;

    var selected = [];
    var lastSelected = null;
    var timeout;
    var reconnect;

    var settings = config.getAllSettings();

    var refreshRate = settings.refreshRate || 2000;

    $scope.settings = config.getAllSettings();
    $scope.connectionLost = false;
    $scope.torrents = {};
    $scope.arrayTorrents = [];
    $scope.contextMenu = null;
    $scope.showDragAndDrop = false;
    $scope.labelsDrowdown = null;
    $scope.torrentLimit = LIMIT;
    $scope.labels = [];
    $scope.trackers = [];
    $scope.guiBusy = true;

    $scope.filters = {
        status: 'all',
        search: '',
        options: { debounce: 150 }
    };

    var fuseOptions = {
        tokenize: true,
        matchAllTokens: true,
        findAllMatches: true,
        threshold: 0.15,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        minMatchCharLength: 1,
        keys: [
            "decodedName"
        ]
    };

    var fuse = new Fuse($scope.arrayTorrents, fuseOptions)

    $rootScope.$on('show:draganddrop', function(event, show) {
        $scope.showDragAndDrop = show;
        $scope.$apply();
    })

    $scope.$on('new:settings', function(event, data) {
        refreshRate = data.refreshRate
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
        $rootScope.$btclient.setLabel(getSelectedHashes(), label)
            .then(function() {
                $scope.update();
            })
            .catch(function() {
                $notify.alert("Could not set label", "The label could not be changed. Please go to settings and configure your connection");
            })
    }

    $scope.renderDone = function() {
        $scope.guiBusy = false
        $timeout(function() {
            $scope.$emit('hide:loading')
        }, 100)
    }

    $scope.$on('start:torrents', function(event, fullupdate){
        $scope.update(!!fullupdate);
        startTimer();
    });

    $scope.$on('wipe:torrents', function(){
        $scope.connectionLost = false;
        clearAll()
        $scope.filters = {
            status: 'all'
        };
        $notify.enableAll()
    })

    $scope.$on('stop:torrents', function(){
        stopTimer();
    })

    $scope.$on('show:settings', function(){
        stopTimer();
    });

    $scope.$on('select:torrents', function(){
        selectAll()
    })

    function selectAll() {
        deselectAll()
        for (var i = 0; i < $scope.arrayTorrents.length; i++){
            var torrent = $scope.arrayTorrents[i]
            torrent.selected = true;
            selected.push(torrent)
        }
        $scope.$apply()
    }

    function startTimer(fullupdate){
        if (reconnect) $timeout.cancel(reconnect)
        if (timeout) $timeout.cancel(timeout)
        timeout = $timeout(function(){
            $scope.update(fullupdate)
            .then(function(){
                startTimer();
                $scope.connectionLost = false;
            }).catch(function() {
                $notify.alert("Connection lost", "Trying to reconnect")
                $scope.connectionLost = true;
                startReconnect();
            });
        }, refreshRate);
    }

    function startReconnect() {
        $notify.disableAll();
        reconnect = $timeout(function() {
            $rootScope.$server.connect()
            .then(function() {
                return $scope.update(true)
            }).then(function() {
                $notify.enableAll();
                $notify.ok("Reconnected", "The connection has been reestablished")
                $scope.connectionLost = false;
                startTimer(true);
            }).catch(function() {
                startReconnect()
            })
        }, refreshRate)
    }

    function clearAll() {
        $scope.torrents = {};
        $scope.arrayTorrents = [];
        $scope.labels = [];
        $scope.trackers = [];
    }

    function resetAll() {
        clearAll()
        $scope.update(true)
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

    $scope.filterBySearch = function(search){
        $scope.isSearching = true
        deselectAll()
        lastSelected = null;
        $scope.torrentLimit = LIMIT;
        refreshTorrents();
    }

    $scope.filterByLabel = function(label){
        deselectAll();
        lastSelected = null;
        $scope.filters.label = label;
        $scope.torrentLimit = LIMIT;
        refreshTorrents();
    }

    $scope.activeLabel = function(label) {
        return $scope.filters.label === label;
    }

    $scope.filterByTracker = function(tracker) {
        deselectAll();
        lastSelected = null;
        $scope.filters.tracker = tracker;
        $scope.torrentLimit = LIMIT;
        refreshTorrents();
    }

    $scope.activeTracker = function(tracker) {
        return $scope.filters.tracker === tracker;
    }

    $scope.showContextMenu = function(event, torrent /*, index*/) {
        if (!torrent.selected){
            singleSelect(torrent);
        }
        $scope.contextMenu.show(event, selected);
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

    function toggleSelect(target){
        var torrent = $scope.torrents[target.hash]
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

    function singleSelect(target){
        deselectAll();
        var torrent = $scope.torrents[target.hash]
        if (!torrent) return
        torrent.selected = true
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
        if (event.ctrlKey || event.metaKey){
            toggleSelect(torrent);
        } else if (event.shiftKey){
            multiSelect(index);
        } else {
            singleSelect(torrent);
        }
    }

    function getSelectedHashes(){
        var hashes = [];
        angular.forEach(selected, function(torrent){
            hashes.push(torrent.hash)
        })
        return hashes;
    }

    $scope.doAction = function(action, name, data) {
        return action.call($rootScope.$btclient, selected, data)
            .then(function(){
                return $scope.update();
            })
            .catch(function(err) {
                console.error('Action error', err)
                $notify.alert("Invalid action", "The action could not be performed because the server responded with a faulty reply");
            });
    };

    $scope.doContextAction = function(action) {
        return action.call($rootScope.$btclient, selected)
            .then(function(){
                return $scope.update();
            })
            .catch(function(err) {
                console.error('Context action error', err)
                $notify.alert("Invalid action", "The action could not be performed because the server responded with a faulty reply");
            })
    }

    function fetchTorrents(){
        return Array.from(Object.values($scope.torrents))
    }

    $scope.changeSorting = function(sortName, descending) {
        $scope.torrentLimit = LIMIT;
        $scope.filters.sort = sortName;
        $scope.filters.order = descending;
        refreshTorrents();
    }

    function torrentSorter(){
        var sort = $scope.filters.sort || 'dateAdded';
        var desc = $scope.filters.order;

        let column = $rootScope.$server.columns.find(c => c.attribute === sort)
        let sorter = column.sort
        //var sorter = AbstractTorrent.sort(sort);

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

    function trackerFilter(filterTracker) {
      return function(torrent) {
        return torrent.trackers && torrent.trackers.some((tracker) => {
          return tracker && tracker.includes(filterTracker)
        })
      }
    }

    function searchFilter(search) {
      return function(torrent) {
        return torrent.name.toLowerCase().includes(search.toLowerCase())
      }
    }

    function torrentFilter(status, label, tracker, search){
        var filterStatus = status || $scope.filters.status;
        var filterLabel = label || $scope.filters.label;
        var filterTracker = tracker || $scope.filters.tracker;
        var filterSearch = search || $scope.filters.search;

        var filters = [];

        if (filterStatus) {
            filters.push(function(torrent) {
              return statusFilter(torrent, filterStatus)
            });
        }

        if (filterLabel) {
            filters.push(function(torrent) {
              return torrent.label === filterLabel
            })
        }

        // if (filterSearch) {
        //     filters.push(searchFilter(filterSearch))
        // }

        if (filterTracker) {
            filters.push(trackerFilter(filterTracker))
        }

        return function(torrent){
            return filters.every(function(filter) {
                return filter(torrent);
            });
        }
    }

    function fuzzySearch(torrents, search) {
        if ($scope.filters.search) {
            search = search || $scope.filters.search
            fuse.setCollection(torrents)
            return fuse.search(search)
        } else {
            return torrents
        }
    }

    function refreshTorrents(){
        var torrents = fetchTorrents();
        torrents = torrents.filter(torrentFilter());
        torrents = fuzzySearch(torrents);
        torrents = torrents.sort(torrentSorter());
        $scope.isSearching = false
        $scope.arrayTorrents = torrents;
    }

    function reassignSelected() {
        var newSelected = []
        selected.forEach(function(torrent){
            var delegate = $scope.torrents[torrent.hash];
            if (delegate){
                delegate.selected = true
                newSelected.push(delegate)
            }
        })
        selected = newSelected
        reassignLastSelected()
    }

    function reassignLastSelected() {
        if(!lastSelected) return
        var lastDelegate = $scope.torrents[lastSelected.hash];
        if(lastDelegate) {
            lastSelected = lastDelegate
        } else {
            lastSelected = null
        }
    }

    $scope.update = function(fullupdate) {
        var serverId = $rootScope.$server.id
        var q = $rootScope.$btclient.torrents(!!fullupdate)
        return q.then(function(torrents) {
            if (serverId !== $rootScope.$server.id) {
                return $q.resolve()
            }
            newTorrents(torrents);
            deleteTorrents(torrents);
            changeTorrents(torrents);
            updateLabels(torrents);
            updateTrackers(torrents);
        }).then(function() {
            if (!$scope.arrayTorrents || $scope.arrayTorrents.length === 0) {
                $scope.renderDone()
            }
        }).catch(function(err) {
            $scope.renderDone()
            return $q.reject(err)
        })
    };

    function checkNotification(old, updated) {
        if (!old || !updated) return
        if (updated.percent === 1000 && old.percent < 1000) {
            if (settings.ui.notifications === true){
                $notify.torrentComplete(old);
            }
        }
    }

    function newTorrents(torrents){
        if ((torrents.all && torrents.all.length > 0) || torrents.dirty === true) {
            var torrentMap = {};
            for (var i = 0; i < torrents.all.length; i++){
                var torrent = torrents.all[i];
                torrentMap[torrent.hash] = torrent;
                var old = $scope.torrents[torrent.hash];
                checkNotification(old, torrent);
            }
            $scope.torrents = torrentMap;
            reassignSelected()
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
                checkNotification(existing, torrent);

                if (existing) {
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

    function updateTrackers(torrents) {
        if (torrents.trackers && torrents.trackers.length > 0) {
            torrents.trackers.forEach(function(tracker) {
                if (!$scope.trackers.includes(tracker)) {
                    $scope.trackers.push(tracker)
                }
            })
        }
    }

}])
