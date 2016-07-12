var torrentApp = angular.module("torrentApp", ["ngResource", "ngAnimate", "ngTableResize", "infinite-scroll"]);

// Set application menu
torrentApp.run(['menuWin', 'menuMac', 'electron', function(menuWin, menuMac, electron){
    var menu = null;

    if (process.platform === 'darwin') {
        menu = menuMac;
    }
    else {
        menu = menuWin;
    }
    
    var appMenu = electron.menu.buildFromTemplate(menu);
    electron.menu.setApplicationMenu(appMenu);
}]);


angular.module("torrentApp").controller("mainController", ["$rootScope", "$scope", "$timeout", "utorrentService", "electron", "configService", function ($rootScope, $scope, $timeout, $utorrentService, electron, config) {
    const PAGE_SETTINGS = 'settings';
    const PAGE_WELCOME = 'welcome';

    $scope.showTorrents = false;
    var page = null;

    $rootScope.$on('ready', function() {
        var data = config.getServer()
        if (data){
            console.log("Connect", data);
            connectToServer(data.ip, data.port, data.user, data.password)
        } else {
            // First time starting application
            pageWelcome();
        }
    });

    //pageSettings();

    function connectToServer(ip, port, user, password){
        $utorrentService.connect(ip, port, user, password)
        .then(function(){
            pageTorrents();
            requestMagnetLinks();
        })
        .catch(function(){
            pageSettings();
        });
    }

    // Send a request to the main process for magnet links
    function requestMagnetLinks(){
        electron.ipc.send('send:magnets');
    }

    // Listen for incomming magnet links from the main process
    electron.ipc.on('magnet', function(event, data){
        data.forEach(function(magnet){
            $utorrentService.addTorrentUrl(magnet);
        })
    })

    function pageTorrents(){
        console.info("Show torrents page!");
        $scope.showTorrents = true;
        $scope.$broadcast('start:torrents');
        page = null;
    }

    function pageSettings(){
        page = PAGE_SETTINGS;
    }

    function pageWelcome(){
        page = PAGE_WELCOME;
    }

    $scope.$on('show:settings', function() {
        page = PAGE_SETTINGS;
        $scope.$apply();
    })

    $scope.$on('show:welcome', function() {
        page = PAGE_WELCOME;
        $scope.$apply();
    })

    $scope.$on('show:torrents', function(){
        console.info("#Show torrents!");
        pageTorrents();
    })

    $scope.$on('emit:new:settings', function(event, data) {
        //event.stopPropagation();
        console.log("Main recieved new settings", data);
        $scope.$broadcast('new:settings', data)
    })

    $scope.showSettings = function(){
        return page === PAGE_SETTINGS;
    }

    $scope.showWelcome = function() {
        return page === PAGE_WELCOME;
    }

}]);

"use strict";

angular.module("torrentApp").controller("torrentsController", ["$scope", "$timeout", "$filter", "$log", "utorrentService", "notificationService", "configService", function ($scope, $timeout, $filter, $log, $utorrentService, $notify, config) {
    const TIMEOUT = 2000;
    const LIMIT = 25;

    var ut = $utorrentService;
    var selected = [];
    var lastSelected = null;
    var timeout;

    var settings = config.settings();

    $scope.torrents = {};
    $scope.arrayTorrents = [];
    $scope.contextMenu = null;
    $scope.labelsDrowdown = null;
    $scope.torrentLimit = LIMIT;
    $scope.labels = {};
    $scope.resizeMode = settings.ui.resizeMode;

    $scope.filters = {
        status: 'downloading'
    };

    $scope.$on('new:settings', function(event, data) {
        console.log("New sttings!", data);
        $scope.resizeMode = data.ui.resizeMode;
    })

    $scope.showMore = function() {
        $scope.torrentLimit += LIMIT;
    };

    $scope.debug = function(){
        for (var i = 0; i < selected.length; i++){
            console.info(selected[i]);
        }
        $scope.contextMenu.hide();
    };

    $scope.activeOn = function(filter) {
        if ($scope.filters.status === filter){
            return 'active';
        } else {
            return '';
        }
    }

    $scope.setLabel = function(label){
        ut.setLabel(getSelectedHashes(), label)
            .then(function() {
                $scope.update();
            })
            .catch(function() {
                $notify.alert("Could not set label", "The label could not be changes. Please go to settings and configure your connection");
            })
    }

    $scope.$on('start:torrents', function(){
        console.info("Received start torrents!");
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

    $scope.showContextMenu = function(event, torrent /*, index*/) {
        if (!torrent.selected){
            singleSelect(torrent);
        }
        $scope.contextMenu.show(event);
        console.info("Right click context menu!");
    };

    $scope.numInFilter = function(status) {
        var num = 0;
        angular.forEach($scope.torrents, function(torrent /*, hash*/) {
            if (statusFilter(torrent, status)){
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
        $scope.labelsDrowdown.clear();
        if (event.ctrlKey || event.metaKey){
            toggleSelect(torrent);
        } else if (event.shiftKey){
            multiSelect(index);
        } else {
            singleSelect(torrent);
        }
        //console.log("Selected", selected);
    }

    $scope.update = function() {
        var q = ut.torrents()
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

    $scope.doAction = function(action) {
        var call = ut.actions()[action];
        if (call){
            call({ hash: getSelectedHashes()}).$promise
            .then(function(){
                console.log("Action " + action + " performed!");
                $scope.update();
            })
            .catch(function(err) {
                $notify.alert("Invalid action", err);
            })
        } else {
            $notify.alert("Invalid action", "Action " + action + " is not allowed!");
        }
    };

    $scope.doContextAction = function(action) {
        $scope.contextMenu.hide();
        $scope.doAction(action);
    }

    function fetchTorrents(){
        var results = [];
        angular.forEach($scope.torrents, function(torrent /*, hash*/) {
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
            case 'stopped': return torrent.isStatusStopped();
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
                var existing = $scope.torrents[torrent.hash];

                if (existing){
                    existing.update(torrents.changed[i]);
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
                if (!$scope.labels[label[0]]){
                    $scope.labels[label[0]] = label[1];
                }
            })
        }
    }

}])

angular.module("torrentApp").controller("settingsController", ["$scope", "utorrentService", "configService", "notificationService", "electron", function($scope, $utorrentService, config, $notify, electron) {

    // External Settings reference
    $scope.settings = {
        server: {
            ip: '',
            port: '',
            user: '',
            password: ''
        },
        ui: {
            resizeMode: ''
        }
    };

    // Internal settings reference
    $scope.general = {
        magnet: false
    }

    $scope.connecting = false;
    $scope.page = 'general';

    loadAllSettings();

    function loadAllSettings() {
        $scope.settings = config.getAllSettings();
        // $scope.server = config.getServer()

        $scope.general = {
            magnets: electron.app.isDefaultProtocolClient('magnet')
        }
        
    }

    function subscribeToMagnets() {
        if ($scope.general.magnets) {
            console.log("Set handler!");
            electron.app.setAsDefaultProtocolClient('magnet');
        } else {
            console.log("Remove handler!");
            electron.app.removeAsDefaultProtocolClient('magnet');
        }
    }

    $scope.$on('show:settings', function() {
        console.info("Update settings!")
        loadAllSettings();
    })

    function writeSettings() {
        config.saveAllSettings($scope.settings)
            .then(function() {
                $scope.close();
                $notify.ok("Saved Settings", "You settings has been updated")
            })
            .catch(function(err) {
                $notify.alert("Settings could not be saved", err)
            })
        subscribeToMagnets();
    }

    $scope.close = function() {
        $scope.$emit('show:torrents');
        loadAllSettings();
    }

    $scope.save = function() {
        $scope.connecting = true;
        var ip = $scope.settings.server.ip;
        var port = $scope.settings.server.port;
        var user = $scope.settings.server.user;
        var password = $scope.settings.server.password;

        $utorrentService.connect(ip, port, user, password)
            .then(function() {
                writeSettings();
                $scope.$emit('emit:new:settings', $scope.settings)
                $scope.connecting = false;
            })
            .catch(function(err) {
                console.error("Oh noes!", err);
                $scope.connecting = false;
            })
    }

    $scope.activeOn = function(page) {
        var value = '';
        if ($scope.page === page) value = 'active';
        return value;
    }

    $scope.gotoPage = function(page) {
        $scope.page = page;
    }

}]);

angular.module("torrentApp").controller("welcomeController", ["$scope", "$timeout", "utorrentService", "electron", "configService", "notificationService", function ($scope, $timeout, $utorrentService, electron, config, $notify) {

    $scope.connecting = false;

    $scope.connect = function() {
        $scope.connecting = true;

        var ip = $scope.ip || '';
        var port = $scope.port || '';
        var user = $scope.username || '';
        var password = $scope.password || '';

        $utorrentService.connect(ip, port, user, password).then(function() {
            $timeout(function(){
                saveServer(ip, port, user, password);
                $notify.ok("Success!", "Hooray! Welcome to Electorrent")
            }, 500)
        }).catch(function(err) {
            $timeout(function(){
                console.error(err);
                $scope.connecting = false;
            }, 500)
        })
    }

    function saveServer(ip, port, username, password){
        config.saveServer(ip, port, username, password)
        .then(function(){
            $scope.$emit('show:torrents');
        })
        .catch(function(){
            $scope.connecting = false;
        })
    }

}]);

angular.module("torrentApp").controller("notificationsController", ["$scope", "$rootScope", function($scope, $rootScope) {

    $scope.notifications = [];

    $scope.close = function(index){
        $scope.notifications.splice(index, 1);
    }

    $rootScope.$on('notification', function(event, data){
        $scope.notifications.push(data);
    })

}]);

'use strict';

angular.module('torrentApp')
    .factory('Torrent', function($window, $log) {

        var decodeNames = true;
        // if ($cookies.get(ntuConst.decodeNames)) {
        //     decodeNames = $cookies.get(ntuConst.decodeNames) === 'true';
        // } else {
        //     decodeNames = true;
        // }

        var decodeName = function(name) {
            if (decodeNames) {
                return name.replace(/[\._]/g, ' ').replace(/(\[[^\]]*\])(.*)$/, '$2 $1').trim();
            } else {
                return name;
            }
        };

        var cleanName = function(name) {
            return name.toLowerCase().replace(/s?([0-9]{1,2})[x|e|-]([0-9]{1,2})/, '').replace(/(bdrip|brrip|cam|dttrip|dvdrip|dvdscr|dvd|fs|hdtv|hdtvrip|hq|pdtv|satrip|dvbrip|r5|r6|ts|tc|tvrip|vhsrip|vhsscr|ws|aac|ac3|dd|dsp|dts|lc|ld|md|mp3|xvid|720p|1080p|fs|internal|limited|proper|stv|subbed|tma|tnz|silent|tls|gbm|fsh|rev|trl|upz|unrated|webrip|ws|mkv|avi|mov|mp4|mp3|iso|x264|x265|h264|h265)/g, '').trim();
        };

        /**
        hash (string),
        status* (integer),
        name (string),
        size (integer in bytes),
        percent progress (integer in per mils),
        downloaded (integer in bytes),
        upload-speeded (integer in bytes),
        ratio (integer in per mils),
        upload-speed speed (integer in bytes per second),
        download speed (integer in bytes per second),
        eta (integer in seconds),
        label (string),
        peers connected (integer),
        peers in swarm (integer),
        seeds connected (integer),
        seeds in swarm (integer),
        availability (integer in 1/65535ths),
        torrent queue order (integer),
        remaining (integer in bytes)
        */

        /**
         * Constructor, with class name
         */
        function Torrent(hash,
            status,
            name,
            size,
            percent,
            downloaded,
            uploaded,
            ratio,
            uploadSpeed,
            downloadSpeed,
            eta,
            label,
            peersConnected,
            peersInSwarm,
            seedsConnected,
            seedsInSwarm,
            availability,
            torrentQueueOrder,
            remaining,
            downloadUrl,
            rssFeedUrl,
            statusMessage,
            streamId,
            dateAdded,
            dateCompleted,
            appUpdateUrl,
            savePath,
            additionalData) {

            this.selected = false;
            this.isStarred = false;

            this.hash = hash;
            this.status = status;
            this.name = name;
            this.size = size;
            this.percent = percent;
            this.downloaded = downloaded;
            this.uploaded = uploaded;
            this.ratio = (ratio / 1000).toFixed(2);
            this.uploadSpeed = uploadSpeed;
            this.downloadSpeed = downloadSpeed;
            this.eta = eta;
            this.label = label;
            this.peersConnected = peersConnected;
            this.peersInSwarm = peersInSwarm;
            this.seedsConnected = seedsConnected;
            this.seedsInSwarm = seedsInSwarm;
            this.availability = (availability / 65536).toFixed(1);
            this.torrentQueueOrder = torrentQueueOrder;
            this.remaining = remaining;
            this.downloadUrl = downloadUrl;
            this.rssFeedUrl = rssFeedUrl;
            this.statusMessage = statusMessage;
            this.streamId = streamId;
            this.dateAdded = dateAdded * 1000;
            this.dateCompleted = dateCompleted * 1000;
            this.appUpdateUrl = appUpdateUrl;
            this.savePath = savePath;
            this.additionalData = additionalData;

            this.decodedName = decodeName(this.name);
            this.getStatuses();
            this.cleanedName = cleanName(this.decodedName);
        }


        var statusesMap = {
            1: 'started',
            2: 'checking',
            4: 'startaftercheck',
            8: 'checked',
            16: 'error',
            32: 'paused',
            64: 'queued',
            128: 'loaded'
        };
        var statusesFlags = [1, 2, 4, 8, 16, 32, 64, 128].reverse();

        Torrent.prototype.bind = function(hash,
            status,
            name,
            size,
            percent,
            downloaded,
            uploaded,
            ratio,
            uploadSpeed,
            downloadSpeed,
            eta,
            label,
            peersConnected,
            peersInSwarm,
            seedsConnected,
            seedsInSwarm,
            availability,
            torrentQueueOrder,
            remaining,
            downloadUrl,
            rssFeedUrl,
            statusMessage,
            streamId,
            dateAdded,
            dateCompleted,
            appUpdateUrl,
            savePath,
            additionalData) {

            this.hash = hash;
            this.status = status;
            this.name = name;
            this.size = size;
            this.percent = percent;
            this.downloaded = downloaded;
            this.uploaded = uploaded;
            this.ratio = (ratio / 1000).toFixed(2);
            this.uploadSpeed = uploadSpeed;
            this.downloadSpeed = downloadSpeed;
            this.eta = eta;
            this.label = label;
            this.peersConnected = peersConnected;
            this.peersInSwarm = peersInSwarm;
            this.seedsConnected = seedsConnected;
            this.seedsInSwarm = seedsInSwarm;
            this.availability = (availability / 65536).toFixed(1);
            this.torrentQueueOrder = torrentQueueOrder;
            this.remaining = remaining;
            this.downloadUrl = downloadUrl;
            this.rssFeedUrl = rssFeedUrl;
            this.statusMessage = statusMessage;
            this.streamId = streamId;
            this.dateAdded = dateAdded * 1000;
            this.dateCompleted = dateCompleted * 1000;
            this.appUpdateUrl = appUpdateUrl;
            this.savePath = savePath;
            this.additionalData = additionalData;

            this.decodedName = decodeName(this.name);
            this.getStatuses();
            this.cleanedName = cleanName(this.decodedName);
        };

        Torrent.prototype.update = function(array) {
            this.bind.apply(this, array);
        };

        Torrent.prototype.getMagnetURI = function(longUri) {
            var i = 0;
            var link = 'magnet:?xt=urn:btih:' + this.hash;
            if (longUri) {
                link += '&dn=' + encodeURIComponent(this.name);
                link += '&xl=' + encodeURIComponent(this.size);

                if (this.props && this.props.trackers) {
                    var trackers = this.props.trackers.split('\r\n');
                    for (i = 0; i < trackers.length; i++) {
                        if (trackers[i].length > 0) {
                            link += '&tr=' + encodeURIComponent(trackers[i]);
                        }
                    }
                }
            }
            return link;
        };

        Torrent.prototype.getStatusFlag = function(x) {
            /*jshint bitwise: false*/
            return (this.status & x) === x;
            /*jshint bitwise: true*/
        };

        Torrent.prototype.getStatuses = function() {
            //var str = '';
            var i = 0;

            if (this.statusesCached) {
                return this.statusesCached;
            }
            var res = [];

            for (i = 0; i < statusesFlags.length; i++) {
                if (this.getStatusFlag(statusesFlags[i])) {
                    res.push(statusesMap[statusesFlags[i]]);
                }
            }
            if (this.status > 255) {
                res.push('unknown');
                $log.warn('unknown status: ' + this.status);
            }

            if (this.percent === 1000) {
                res.push('completed');
            }

            this.statusesCached = res;

            return this.statusesCached;
        };

        Torrent.prototype.isStatusStarted = function() {
            return this.getStatusFlag(1);
        };
        Torrent.prototype.isStatusChecking = function() {
            return this.getStatusFlag(2);
        };
        Torrent.prototype.isStatusStartAfterCheck = function() {
            return this.getStatusFlag(4);
        };
        Torrent.prototype.isStatusChecked = function() {
            return this.getStatusFlag(8);
        };
        Torrent.prototype.isStatusError = function() {
            return this.getStatusFlag(16);
        };
        Torrent.prototype.isStatusPaused = function() {
            return this.getStatusFlag(32);
        };
        Torrent.prototype.isStatusQueued = function() {
            return this.getStatusFlag(64) && !this.isStatusDownloading();
        };
        Torrent.prototype.isStatusLoaded = function() {
            return this.getStatusFlag(128);
        };
        Torrent.prototype.isStatusCompleted = function() {
            return (this.percent === 1000);
        };
        Torrent.prototype.isStatusDownloading = function() {
            return this.getStatusFlag(64);
        };
        Torrent.prototype.isStatusSeeding = function() {
            return this.isStatusStarted() && (this.isStatusCompleted());
        };
        Torrent.prototype.isStatusStopped = function() {
            return (!this.getStatusFlag(64)) && (!this.isStatusCompleted());
        };

        Torrent.prototype.getQueueStr = function() {
            if (this.torrentQueueOrder === -1) {
                return '*';
            }
            return this.torrentQueueOrder;
        };

        Torrent.prototype.getPercentStr = function() {
            return (this.percent / 10).toFixed(0) + '%';
        };

        var formatBytesCache = {};

        function formatBytes(bytes) {
            if (formatBytesCache[bytes]) {
                return formatBytesCache[bytes];
            }
            var val;
            var uom;

            if (bytes < 1024) {
                val = bytes;
                uom = 'B';
            } else if (bytes < 1048576) {
                val = (bytes / 1024).toFixed(1);
                uom = 'KB';
            } else if (bytes < 1073741824) {
                val = (bytes / 1048576).toFixed(1);
                uom = 'MB';
            } else {
                val = (bytes / 1073741824).toFixed(1);
                uom = 'GB';
            }
            return [val, uom];
        }

        Torrent.prototype.formatBytesStrArr = function(bytes) {
            return formatBytes(bytes);
        };

        Torrent.prototype.formatBytes = function(bytes) {
            return formatBytes(bytes).join('');
        };

        Torrent.prototype.getDownloadedStrArr = function() {
            if (!this.downloadedStrArr) {
                this.downloadedStrArr = formatBytes(this.downloaded);
            }
            return this.downloadedStrArr;
        };

        Torrent.prototype.getUploadedStrArr = function() {
            if (!this.uploadedStrArr) {
                this.uploadedStrArr = formatBytes(this.uploaded);
            }
            return this.uploadedStrArr;
        };

        Torrent.prototype.getSizeStrArr = function() {
            if (!this.sizeStrArr) {
                this.sizeStrArr = formatBytes(this.size);
            }
            return this.sizeStrArr;
        };

        Torrent.prototype.getUpSpeedStrArr = function() {
            if (!this.upSpeedStrArr) {
                var res = formatBytes(this.uploadSpeed);
                res[1] = res[1] + '/s';
                this.upSpeedStrArr = res;
            }
            return this.upSpeedStrArr;
        };

        Torrent.prototype.getDownSpeedStrArr = function() {
            if (!this.downSpeedStrArr) {
                var res = formatBytes(this.downloadSpeed);
                res[1] = res[1] + '/s';
                this.downSpeedStrArr = res;
            }
            return this.downSpeedStrArr;
        };

        Torrent.prototype.getLabels = function() {
            if (typeof this.label === 'string') {
                return [this.label];
            } else {
                return this.label;
            }
        };

        Torrent.prototype.getMainLabel = function() {
            var labels = this.getLabels();
            if (labels && labels.length > 0) {
                return labels[0];
            } else {
                return '';
            }
        };

        Torrent.cache = {};

        /**
         * Return the constructor function
         */
        return Torrent;
    });

'use strict';

angular.module('torrentApp')
    .service('utorrentService', ["$http", "$resource", "$log", "$q", "Torrent", "notificationService", function($http, $resource, $log, $q, Torrent, $notify) {

        var loading = null;
        var data = {
            url: null,
            username: null,
            password: null,
            token: null,
            cid: 0,
            build: -1
        };

        var updateCidInterceptor = {
            response: function(response) {
                data.cid = response.data.torrentc;
            },
            responseError: function(response) {
                console.log('error in interceptor', data, arguments, response);
            }
        };

        var torrentServerService = {
            conf: data,
            connect: function(ip, port, username, password) {
                data.username = username;
                data.password = password;
                data.url = 'http://'+ip+':'+port+'/gui/';
                return torrentServerService.auth();
            },
            auth: function() {
                var loading = $q.defer();
                $log.info('get token');
                var encoded = new Buffer(data.username+":"+data.password).toString('base64');
                $http.defaults.headers.common.Authorization = 'Basic ' + encoded;
                $http.get(data.url + 'token.html?t=' + Date.now(), {
                    timeout: 5000
                }).
                success(function(str) {
                    var match = str.match(/>([^<]+)</);
                    if (match) {
                        data.token = match[match.length - 1];
                        loading.resolve(data.token);
                        $log.info('got token ' + data.token);
                    }
                }).error(function(err, status) {
                    $notify.alertAuth(err, status);
                    loading.reject(err || 'Error loading token', status);
                });
                return loading.promise;
            },
            init: function() {
                if (data.token) {
                    $log.info('token already cached');
                    loading.resolve(data.token);
                    return loading.promise;
                }

                if (loading !== null) {
                    $log.info('token load in progress. Deferring callback');
                    return loading.promise;
                } else {
                    loading = $q.defer();
                }

                $log.info('get token');
                var encoded = new Buffer("admin:").toString('base64');
                $http.defaults.headers.common.Authorization = 'Basic ' + encoded;
                $http.get(data.url + 'token.html?t=' + Date.now(), {
                    timeout: 30000
                }).
                success(function(str) {
                    var match = str.match(/>([^<]+)</);
                    if (match) {
                        data.token = match[match.length - 1];
                        loading.resolve(data.token);
                        $log.info('got token ' + data.token);
                    }
                }).error(function() {
                    loading.reject('Error loading token');
                    $log.error(arguments);
                });
                return loading.promise;
            },
            addTorrentUrl: function(url, dir, path) {
                return $resource(data.url + '.' + '?token=:token&action=add-url&s=:url&download_dir=:dir&path=:path&t=:t', {
                    token: data.token,
                    t: Date.now(),
                    url: url,
                    dir: dir,
                    path: path
                }).get().$promise;

            },
            // uploadTorrent: function(file, dir, path) {
            //     return $upload.upload({
            //         url: data.url + '?token=' + data.token + '&action=add-file&download_dir=' + encodeURIComponent(dir) + '&path=' + encodeURIComponent(path),
            //         method: 'POST',
            //         file: file, // single file or a list of files. list is only for html5
            //         //fileName: 'doc.jpg' or ['1.jpg', '2.jpg', ...] // to modify the name of the file(s)
            //         fileFormDataName: 'torrent_file', // file formData name ('Content-Disposition'), server side request form name
            //         // could be a list of names for multiple files (html5). Default is 'file'
            //         //formDataAppender: function(formData, key, val){}  // customize how data is added to the formData.
            //         // See #40#issuecomment-28612000 for sample code
            //     });
            // },
            torrents: function() {
                var ret = $q.defer();
                var torrents = {
                    labels: [],
                    all:[],
                    changed: [],
                    deleted: []
                };
                var utorrentRes = this._torrents().list(
                    function() {
                        torrents.labels = utorrentRes.label;
                        torrents.all = utorrentRes.torrents;
                        torrents.changed = utorrentRes.torrentp;
                        torrents.deleted = utorrentRes.torrentm;
                        ret.resolve(torrents);
                    },
                    function(err) {
                        ret.reject(err);
                    }
                );

                return ret.promise;
            },
            _torrents: function() {
                return $resource(data.url + '.' + '?:action:data&token=:token&cid=:cid:opt&t=:t', {
                    token: data.token,
                    cid: data.cid,
                    t: Date.now()
                }, {
                    list: {
                        method: 'GET',
                        params: {
                            action: 'list=1'
                        },
                        transformResponse: function(response) {
                            return angular.fromJson(response.replace(/[\x00-\x1F]/g, ''));
                        },
                        interceptor: updateCidInterceptor,
                        isArray: false
                    }
                });
            },
            actions: function() {
                return $resource(data.url + '.' + '?action=:action&token=:token&t=:t', {
                    token: data.token,
                    cid: data.cid,
                    t: Date.now()
                }, {
                    start: {
                        params: {
                            action: 'start'
                        }
                    },
                    stop: {
                        params: {
                            action: 'stop'
                        }
                    },
                    pause: {
                        params: {
                            action: 'pause'
                        }
                    },
                    remove: {
                        params: {
                            action: 'remove'
                        }
                    },
                    removedata: {
                        params: {
                            action: 'removedata'
                        }
                    },
                    removetorrent: {
                        params: {
                            action: 'removetorrent'
                        }
                    },
                    removedatatorrent: {
                        params: {
                            action: 'removedatatorrent'
                        }
                    },
                    forcestart: {
                        params: {
                            action: 'forcestart'
                        }
                    },
                    recheck: {
                        params: {
                            action: 'recheck'
                        }
                    },
                    queueup: {
                        params: {
                            action: 'queueup'
                        }
                    },
                    queuedown: {
                        params: {
                            action: 'queuedown'
                        }
                    },
                    getprops: {
                        params: {
                            action: 'getprops'
                        }
                    },
                    getfiles: {
                        params: {
                            action: 'getfiles'
                        },
                        transformResponse: function(response) {
                            var i, file;
                            var fileArr = angular.fromJson(response).files[1];
                            var files = [];
                            for (i = 0; i < fileArr.length; i++) {
                                file = fileArr[i];
                                file = {
                                    hash: i,
                                    name: file[0],
                                    size: file[1],
                                    sizeDownloaded: file[2],
                                    percent: (file[2] / file[1] * 100).toFixed(2),
                                    priority: file[3]
                                };
                                files.push(file);
                            }
                            return {
                                files: files
                            };
                        }
                    },
                    _getsettings: {
                        params: {
                            action: 'getsettings'
                        },
                        isArray: true,
                        transformResponse: function(response) {
                            var responseData = angular.fromJson(response);
                            data.build = responseData.build;
                            responseData = responseData.settings;
                            var settings = [];
                            var settingsMap = {};
                            var i, val;
                            var types = ['int', 'bool', 'string'];
                            for (i = 0; i < responseData.length; i++) {
                                val = {
                                    name: responseData[i][0],
                                    type: types[responseData[i][1]],
                                    value: responseData[i][2],
                                    others: (responseData[i].length > 2) ? responseData[i][3] : undefined
                                };
                                settings.push(val);
                                settingsMap[val.name] = val;
                            }
                            torrentServerService.settings = settings;
                            torrentServerService.settingsMap = settingsMap;
                            torrentServerService.supports = {};
                            if (parseInt(data.build) > 25406) { //Features supported from uTorrent 3+
                                torrentServerService.supports.getDownloadDirectories = true;
                                torrentServerService.supports.torrentAddedDate = true;
                                torrentServerService.supports.torrentCompletedDate = true;
                            }
                            return settings;
                        }
                    }
                });
            },
            removeTorrent: function() {
                var actions = ['remove','removetorrent','removedata','removedatatorrent'];
                var defaultRemove = parseInt(torrentServerService.settingsMap['gui.default_del_action'].value);
                return torrentServerService.actions()[actions[defaultRemove]];
            },
            getFileDownloadUrl: function(torrent,file) {
                if(torrent.streamId && torrentServerService.settingsMap['webui.uconnect_enable'] && file.size === file.sizeDownloaded) {
                    return '/proxy?sid=' + torrent.streamId + '&file=' + file.hash + '&disposition=ATTACHMENT&service=DOWNLOAD&qos=0';
                }
                return undefined;
            },
            setLabel: function(hashes, label) {
                var encodedQuery = '';
                var i;
                for (i = 0; i < hashes.length; i++) {
                    encodedQuery += '&' + ['hash=' + hashes[i], 's=label', 'v=' + encodeURIComponent(label)].join('&');
                }
                return $http.get(data.url + '?token=' + data.token + '&action=setprops' + encodedQuery, {
                    params: {
                        t: Date.now()
                    }
                });
            },
            getSettings: function() {
                return this.actions()._getsettings().$promise;
            },
            setSetting: function(setting, value) {
                return torrentServerService.setSettings([
                    [setting, value]
                ]);
            },
            setSettings: function(settings) { // [ [setting1,value1], [setting2,value2] ]
                var encodedQuery = '';
                var i, val;
                for (i = 0; i < settings.length; i++) {
                    val = settings[i][1];
                    if (val === 'true') {
                        val = '1';
                    } else if (val === 'false') {
                        val = '0';
                    }
                    encodedQuery += '&' + ['s=' + settings[i][0], 'v=' + encodeURIComponent(val)].join('&');
                }
                return $http.get(data.url + '?token=' + data.token + '&action=setsetting' + encodedQuery, {
                    params: {
                        t: Date.now()
                    }
                });
            },
            getDownloadDirectories: function() {
                return $resource(data.url + '.' + '?token=:token&action=list-dirs&t=:t', {
                    token: data.token,
                    t: Date.now()
                }, {
                    get: {
                        isArray: true,
                        transformResponse: function(response) {
                            var responseData = angular.fromJson(response);
                            return responseData['download-dirs'];
                        }
                    }
                }).get().$promise;
            },
            filePriority: function() {
                return $resource(data.url + '.' + '?token=:token&action=setprio&hash=:hash&t=:t&p=:priority', {
                    token: data.token,
                    t: Date.now()
                }, {
                    set: {
                        method: 'GET'
                    }
                });
            },
            getVersion: function() {
                var buildVersionStr = function() {
                    var prefix = 'μTorrent';
                    var preBuild = 'build';
                    return [prefix, preBuild, data.build].join(' ');
                };

                if (data.build === -1) {
                    return '';
                }
                return buildVersionStr();

            },
            build: function(array, additionalData) {
                var torrent = Object.create(Torrent.prototype);
                array.push(additionalData);
                torrent = (Torrent.apply(torrent, array) || torrent);
                return torrent;
            }
        };

        return torrentServerService;
    }]);

angular.module('torrentApp').factory("electron", [function() {
    var o = {};

    // Get the Electron remote
    const remote        = require('electron').remote;

    // Directly accesible modules
    o.ipc               = require('electron').ipcRenderer;
    o.shell             = require('electron').shell;

    //Remote moudles from main process
    o.app               = remote.app;
    o.browserWindow     = remote.browserWindow;
    o.clipboard         = remote.clipboard;
    o.dialog            = remote.dialog;
    o.menu              = remote.Menu;
    o.menuItem          = remote.menuItem;
    o.nativeImage       = remote.nativeImage;
    o.powerMonitor      = remote.powerMonitor;
    o.protocol          = remote.protocol;
    o.screen            = remote.screen;
    o.tray              = remote.shell;
    o.capturer          = remote.capturer;
    o.autoUpdater       = remote.autoUpdater;

    // Custom resources
    o.config            = remote.getGlobal('config');

    // Return object
    return o;
}])

'use strict';

angular.module('torrentApp').service('configService', ['electron', '$q', function(electron, $q) {

    const config = electron.config;

    this.settings = function() {
        return config.settingsReference();
    }

    // Angular wrapper for saving to config
    function put(key, value){
        var q = $q.defer();
        config.put(key, value, function(err){
            if (err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    // Angular wrapper for getting config
    function get(value){
        return config.get(value);
    }

    this.getAllSettings = function() {
        return config.getAllSettings();
    }

    this.saveAllSettings = function(settings) {
        var q = $q.defer();
        config.saveAll(settings, function(err){
            if (err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    this.saveServer = function(ip, port, user, password){
        if (arguments.length === 1){
            return put('server', arguments[0]);
        } else {
            return put('server', {
                ip: ip,
                port: port,
                user: user,
                password: password
            })
        }
    }

    this.getServer = function() {
        return get('server');
    }

    this.getResizeMode = function() {
        return get('resizeMode');
    }

    this.setResizeMode = function(mode) {
        return put('resizeMode', mode);
    }

}]);

'use strict';

angular.module('torrentApp')
    .service('notificationService', ["$rootScope", "electron", function($rootScope, electron) {

        this.alert = function(title, message) {
            sendNotification(title, message, "negative");
        }

        this.warning = function(title, message) {
            sendNotification(title, message, "warning");
        }

        this.ok = function(title, message) {
            sendNotification(title, message, "positive");
        }

        function sendNotification(title, message, type) {
            var notification = {
                title: title,
                message: message,
                type: type
            }
            $rootScope.$emit('notification', notification);
        }

        this.alertAuth = function(message, status){
            if (status === -1){
                this.alert("Connection problem", "The connection to the server timed out!")
            } else if (status === 401){
                this.alert("Connection problem", "You entered an incorrent username/password")
            } else {
                this.alert("Connection problem", "The connection could not be established")
            }
        }

        // Listen for incomming notifications from main process
        electron.ipc.on('notify', function(event, data){
            sendNotification(data.title, data.message, data.type || 'warning');
        })

    }]);

angular.module("torrentApp").filter('date', function() {
        return function(epochtime) {
            return moment(epochtime).fromNow();
        };
    });

angular.module("torrentApp").filter("toArray", function(){
    return function(obj) {
        var result = [];
        angular.forEach(obj, function(val, key) {
            result.push(val);
        });
        return result;
    };
});

angular.module("torrentApp").filter('bytes', function() {
        return function(bytes) {
            var val;
            var uom;

            if (bytes < 1024) {
                val = bytes;
                uom = 'B';
            } else if (bytes < 1048576) {
                val = (bytes / 1024).toFixed(1);
                uom = 'KB';
            } else if (bytes < 1073741824) {
                val = (bytes / 1048576).toFixed(1);
                uom = 'MB';
            } else {
                val = (bytes / 1073741824).toFixed(1);
                uom = 'GB';
            }
            return [val, uom].join(' ');
        };
    });

angular.module("torrentApp").directive('progress', function() {
    return {
        scope: {
            torrent: '=',
        },
        restrict: 'E',
        template: `<div class="ui torrent progress" ng-class="class()" progress="torrent">
            <label>{{label()}}</label>
            <div class="bar"></div>
        </div>`,
        controller: controller,
        replace: true,
        link: link
    };

    function controller($scope){
        $scope.label = $scope.torrent.getPercentStr();

        $scope.class = function(){
            if ($scope.torrent.isStatusPaused()){
                return 'grey';
            } else if ($scope.torrent.isStatusDownloading()){
                return 'blue';
            } else if ($scope.torrent.isStatusError()){
                return 'error';
            } else if ($scope.torrent.isStatusCompleted()){
                return 'success';
            } else {
                return 'disabled';
            }
        }

        $scope.label = function(){
            var label = $scope.torrent.statusMessage;
            if ($scope.torrent.isStatusDownloading()){
                label += (" " + $scope.torrent.getPercentStr());
            }
            return label;
        }
    }

    function link(scope, element /*, attrs*/ ) {
        var torrent = scope.torrent;
        // element.find('.bar').css('width', torrent.percent / 10 + '%')
        // element.find('label').html(torrent.statusMessage);
        //
        scope.$watch(function() {
            return torrent.percent;
        }, function() {
            element.find('.bar').css('width', torrent.getPercentStr());
        });
    }

});

angular.module("torrentApp").directive('ngRightClick', function($parse) {
    return function(scope, element, attrs) {
        var fn = $parse(attrs.ngRightClick);
        element.bind('contextmenu', function(event) {
            scope.$apply(function() {
                event.preventDefault();
                fn(scope, {$event:event});
            });
        });
    };
});

angular.module("torrentApp").directive('contextMenu', ['$document', '$window', function($document, $window) {
    return {
        restrict: 'E',
        link: link
    };

    function link(scope, element, attr){
        element.data('contextmenu',true);

        // Bind show function to scope variable
        scope[attr.bind] = {
            show: showContextMenu(element),
            hide: hideContextMenu(element)
        };

        // Remove context menu when user clicks anywhere not in the context menu
        angular.element($document[0].body).on('click',function(event) {
            var inContext =  angular.element(event.target).inheritedData('contextmenu');
            if (!inContext) {
                $(element).hide();
            }
        });

        //Remove context menu when user presses the escape key
        angular.element($document).on('keyup', function(event){
            if (event.keyCode === 27 /* Escape key */){
                $(element).hide();
            }
        });

        $(element).find('.context.dropdown').each(function(){
            $(this)
            .mouseenter(function(){
                var menu = $(this).find('.menu')
                // var height = menu.innerHeight();
                // menu.addClass('upward');
                // menu.css('margin-top', (-1*height) + 'px')
                menu.show();
            })
            .mouseleave(function(){
                $(this).find('.menu').hide();
            });
        });
    }

    function bindCloseOperations(element) {
        // Remove context menu when the user scrolls the main content
        $('.main-content').one('scroll', function() {
            console.log("Scroll!");
            $(element).hide();
        });

        // Remove context menu on window resize
        $($window).one('resize', function(){
            console.log("Resize!");
            $(element).hide();
        });
    }

    function showContextMenu(element){
        return function(event){
            bindCloseOperations(element);

            var totWidth = $(window).width();
            var totHeight = $(window).height();

            var menuWidth = $(element).width();
            var menuHeight = $(element).height();

            var posX = event.pageX;
            var posY = event.pageY;

            var menuX = posX;
            var menuY = posY;

            if (posX + menuWidth >= totWidth) menuX -= menuWidth;
            if (posY + menuHeight >= totHeight) menuY -= menuHeight;

            $(element).css({
                left: menuX,
                top: menuY,
                display: 'block'
            });
        };
    }

    function hideContextMenu(element) {
        return function(){
            $(element).hide();
        };
    }
}]);

angular.module("torrentApp").directive('dropdown', [function() {
    return {
        restrict: 'A',
        link: link,
        scope: {
            ref: '=?',
            bind: '=?'
        }
    }

    function link(scope, element, attr) {

        $(element).dropdown({
            transition: "vertical flip",
            duration: 100,
            onChange: onChange
        });

        if ('ref' in attr){
            scope.ref = {
                clear: doAction(element, 'clear'),
                refresh: doAction(element, 'refresh'),
                setSelected: doAction(element, 'set selected'),
                getValue: doAction(element, 'get value')
            };
        }

        scope.$watch(function() {
            return scope.bind;
        }, function(newValue) {
            $(element).dropdown('set selected', newValue);
        });

        function onChange(value /*, text, choice*/){
            if (scope.bind){
                scope.bind = value;
            }
        }

    }


    function doAction(element, action) {
        return function(param) {
            $(element).dropdown(action, param);
        }
    }

}]);

angular.module("torrentApp").directive('readyBroadcast', ['$rootScope', '$timeout', function($rootScope, $timeout) {
    return {
        restrict: 'A',
        link: link
    };

    function link(/*scope, element, attr*/){
        $timeout(function(){
            $rootScope.$emit('ready');
        });
    }

}]);

angular.module("torrentApp").directive('checkbox', [function() {
    return {
        restrict: 'A',
        scope: {
            isChecked: '=',
            onCheck: '&',
            onUncheck: '&',
            bind: '='
        },
        link: link
    };

    function link(scope, element /*, attr*/){
        $(element).checkbox({
            onChecked: scope.onCheck,
            onUnchecked: scope.onUncheck,
            onChange: changeHandler(scope, element)
        });

        scope.$watch(function() {return scope.isChecked; }, function(newValue){
            if (newValue === true){
                $(element).checkbox('check');
            } else if (newValue === false){
                $(element).checkbox('uncheck');
            }
        });
    }

    function changeHandler(scope, element){
        return function(){
            if (scope.bind !== undefined){
                scope.bind = $(element).checkbox('is checked');
            }
        }
    }

}]);

angular.module("torrentApp").directive('repeatDone', [function() {
    return function(scope, element, attrs) {
        element.bind('$create', function(/*event*/) {
            if (scope.$first) {
                console.log("Repeat done!");
                scope.$eval(attrs.repeatDone);
            }
        });
    }
}]);

angular.module('torrentApp').factory("menuWin", ['electron', '$rootScope', function(electron, $rootScope) {
    const template = [
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    role: 'undo'
                },
                {
                    label: 'Redo',
                    accelerator: 'Shift+CmdOrCtrl+Z',
                    role: 'redo'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Settings',
                    accelerator: 'Ctrl+,',
                    click: function() {
                        $rootScope.$broadcast('show:settings');
                    }
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    role: 'cut'
                },
                {
                    label: 'Copy',
                    accelerator: 'CmdOrCtrl+C',
                    role: 'copy'
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    role: 'paste'
                },
                {
                    label: 'Paste and Match Style',
                    accelerator: 'Shift+Command+V',
                    role: 'pasteandmatchstyle'
                },
                {
                    label: 'Delete',
                    role: 'delete'
                },
                {
                    label: 'Select All',
                    accelerator: 'CmdOrCtrl+A',
                    role: 'selectall'
                },
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click(item, focusedWindow) {
                        if (focusedWindow) focusedWindow.reload();
                    }
                },
                {
                    label: 'Toggle Full Screen',
                    accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
                    click(item, focusedWindow) {
                        if (focusedWindow)
                        focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
                    }
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
                    click(item, focusedWindow) {
                        if (focusedWindow)
                        focusedWindow.webContents.toggleDevTools();
                    }
                },
            ]
        },
        {
            label: 'Window',
            role: 'window',
            submenu: [
                {
                    label: 'Minimize',
                    accelerator: 'CmdOrCtrl+M',
                    role: 'minimize'
                },
                {
                    label: 'Close',
                    accelerator: 'CmdOrCtrl+W',
                    role: 'close'
                },
            ]
        },
        {
            label: 'Help',
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click() { electron.shell.openExternal('https://github.com/Tympanix/Electorrent'); }
                },
                {
                    label: 'Check For Updates',
                    click() { electron.autoUpdater.checkForUpdates() }
                }
            ]
        },
    ];

    return template;

}])

angular.module('torrentApp').factory("menuMac", ['electron', '$rootScope', function(electron, $rootScope) {
    const name = electron.app.getName();

    const template = [
        {
            label: name,
            submenu: [
                {
                    label: 'About ' + name,
                    role: 'about'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Preferences...',
                    accelerator: 'Command+,',
                    click: function() {
                        $rootScope.$broadcast('show:settings');
                    }
                },
                {
                    label: 'Services',
                    role: 'services',
                    submenu: []
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Hide ' + name,
                    accelerator: 'Command+H',
                    role: 'hide'
                },
                {
                    label: 'Hide Others',
                    accelerator: 'Command+Alt+H',
                    role: 'hideothers'
                },
                {
                    label: 'Show All',
                    role: 'unhide'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Quit',
                    accelerator: 'Command+Q',
                    click() { electron.app.quit(); }
                },
            ]
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    role: 'undo'
                },
                {
                    label: 'Redo',
                    accelerator: 'Shift+CmdOrCtrl+Z',
                    role: 'redo'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Cut',
                    accelerator: 'CmdOrCtrl+X',
                    role: 'cut'
                },
                {
                    label: 'Copy',
                    accelerator: 'CmdOrCtrl+C',
                    role: 'copy'
                },
                {
                    label: 'Paste',
                    accelerator: 'CmdOrCtrl+V',
                    role: 'paste'
                },
                {
                    label: 'Paste and Match Style',
                    accelerator: 'Shift+Command+V',
                    role: 'pasteandmatchstyle'
                },
                {
                    label: 'Delete',
                    role: 'delete'
                },
                {
                    label: 'Select All',
                    accelerator: 'CmdOrCtrl+A',
                    role: 'selectall'
                },
            ]
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Reload',
                    accelerator: 'CmdOrCtrl+R',
                    click(item, focusedWindow) {
                        if (focusedWindow) focusedWindow.reload();
                    }
                },
                {
                    label: 'Toggle Full Screen',
                    accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
                    click(item, focusedWindow) {
                        if (focusedWindow)
                        focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
                    }
                },
                {
                    label: 'Toggle Developer Tools',
                    accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
                    click(item, focusedWindow) {
                        if (focusedWindow)
                        focusedWindow.webContents.toggleDevTools();
                    }
                },
            ]
        },
        {
            label: 'Window',
            role: 'window',
            submenu: [
                {
                    label: 'Close',
                    accelerator: 'CmdOrCtrl+W',
                    role: 'close'
                },
                {
                    label: 'Minimize',
                    accelerator: 'CmdOrCtrl+M',
                    role: 'minimize'
                },
                {
                    label: 'Zoom',
                    role: 'zoom'
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Bring All to Front',
                    role: 'front'
                }
            ]
        },
        {
            label: 'Help',
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click() { electron.shell.openExternal('https://github.com/Tympanix/Electorrent'); }
                },
                {
                    label: 'Check For Updates',
                    click() { electron.autoUpdater.checkForUpdates() }
                }
            ]
        },
    ];

    return template;

}])
