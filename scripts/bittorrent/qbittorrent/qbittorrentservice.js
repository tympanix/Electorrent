'use strict';

angular.module('torrentApp').service('qbittorrentService', ["$http", "$resource", "$log", "$q", "TorrentQ", "notificationService", "httpFormService", function($http, $resource, $log, $q, Torrent, $notify, httpFormService) {

    this.name = 'qBittorrent';

    const boundaryHyphens = 29;
    const hyphen = '-';
    const boundaryUniqueNumber = 6688794727912;
    const httpBoundary = hyphen.repeat(boundaryHyphens).concat(boundaryUniqueNumber);

    var rid = 0;

    const httpform = {
        withCredentials: true,
        transformRequest: httpFormService,
        timeout: 5000,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }
    };

    const config = {
        ip: '',
        port: ''
    }

    function url() {
        var ip, port, path;
        if (arguments.length === 1){
            ip = config.ip;
            port = config.port;
            path = arguments[0];
        } else {
            ip = arguments[0]
            port = arguments[1]
            path = arguments[2]
        }
        return `http://${ip}:${port}${path}`;
    }

    function saveConnection(ip, port) {
        config.ip = ip;
        config.port = port;
    }

    this.connect = function(ip, port, user, pass) {
        var defer = $q.defer();

        $http.post(url(ip, port, '/login'), { username: user, password: pass}, httpform)
        .then(function(response) {
            if(response.data === 'Ok.') {
                saveConnection(ip, port);
                defer.resolve(response);
            } else {
                defer.reject(response, 401)
                defer.reject('Wrong username/password');
            }
        })
        .catch(function(response) {
            if (response.status === 403) {
                defer.reject(response, 'qBittorrent says', response.data)
            } else {
                defer.reject(response);
            }
        });

        return defer.promise;
    }

    this.torrents = function(all) {
        var defer = $q.defer();

        if (all === true) rid = 0;

        $http.get(url('/sync/maindata'), {
            params: {
                rid: rid
            },
            withCredentials: true
        }).success(function(data) {
            defer.resolve(processData(data));
        }).catch(function(err) {
            console.error(err);
            defer.reject(err);
        })

        return defer.promise;
    }

    function processData(data) {
        var torrents = {
            labels: [],
            all: [],
            changed: [],
            deleted: []
        };

        torrents.labels = data.categories;

        if(data.full_update) {
            torrents.all = buildAll(data.torrents);
        } else {
            torrents.changed = buildAll(data.torrents);
        }

        torrents.deleted = data.torrents_removed || [];
        rid = data.rid;
        return torrents;
    }

    function doAction(command, torrents) {
        if(!Array.isArray(torrents)) {
            return $notify.alert('Error', 'Action was passed incorrect arguments')
        }

        var hashes = torrents.map(function(torrent) {
            return torrent.hash
        })

        var promises = [];
        hashes.forEach(function(hash) {
            var req = $http.post(`${url('/command')}/${command}`, {hash: hash}, httpform);
            promises.push(req);
        });

        return $q.all(promises);
    }

    function doMultiAction(command, torrents) {
        var hashes = torrents.map(function(torrent) {
            return torrent.hash
        })

        return $http.post(`${url('/command')}/${command}`, { hashes: hashes }, httpform);
    }

    function doGlobalAction(command) {
        return $http.post(`${url('/command')}/${command}`);
    }

    this.pause = function(hashes) {
        return doAction('pause', hashes);
    }

    this.start = function(hashes) {
        return doAction('resume', hashes);
    }

    this.delete = function(hashes) {
        return doMultiAction('delete', hashes);
    }

    this.deleteWithData = function(hashes) {
        return doMultiAction('deletePerm', hashes);
    }

    this.recheck = function(hashes) {
        return doAction('recheck', hashes);
    }

    this.queueUp = function(hashes) {
        return doMultiAction('increasePrio', hashes);
    }

    this.queueDown = function(hashes) {
        return doMultiAction('decreasePrio', hashes);
    }

    this.queueTop = function(hashes) {
        return doMultiAction('topPrio', hashes);
    }

    this.queueBottom = function(hashes) {
        return doMultiAction('bottomPrio', hashes);
    }

    this.pauseAll = function() {
        return doGlobalAction('pauseAll')
    }

    this.resumeAll = function() {
        return doGlobalAction('resumeAll')
    }

    this.addTorrentUrl = function(magnet) {
        return $http.post(url('/command/download'), { urls: magnet }, httpform)
    }

    this.setCategory = function(torrents, category) {
        var hashes = torrents.map(function(torrent) {
            return torrent.hash
        })

        return $http.post(url('/command/setCategory'), { hashes: hashes, category: category }, httpform)
    }

    this.uploadTorrent = function(buffer, filename) {
        var blob = new Blob([buffer], {type : 'application/x-bittorrent'})
        var formData = new FormData();
        formData.append('torrents', blob, filename);

        return $http.post(url('/command/upload') , formData, {
            headers: { 'Content-Type': undefined },
            transformRequest: function(data) {
                return data;
            }
        });
    }

    function httpPostTorrentData(magnet) {
        var r = [];
        r.push(httpBoundary);

        httpDataAddPart(r, 'urls', magnet);
        httpDataAddPart(r, 'savepath', '');
        httpDataAddPart(r, 'cookie', '');
        httpDataAddPart(r, 'label', '', true);

        return r.join('\n');
    }

    function httpDataAddPart(r, part, data) {
        r.push(`Content-Disposition: form-data; name="${part}"`)
        r.push('');
        r.push(data);
        r.push(httpBoundary);
    }

    function buildAll(torrents) {
        if(!torrents) return [];

        var torrentArray = []

        Object.keys(torrents).map(function(hash) {
            var torrent = new Torrent(hash, torrents[hash]);
            torrentArray.push(torrent);
        });

        return torrentArray;
    }

    this.actionHeader = [
        {
            label: 'Start',
            type: 'button',
            color: 'green',
            click: this.start,
            icon: 'play'
        },
        {
            label: 'Pause',
            type: 'button',
            color: 'red',
            click: this.pause,
            icon: 'pause'
        },
        {
            label: 'More',
            type: 'dropdown',
            color: 'blue',
            icon: 'plus',
            actions: [
                {
                    label: 'Pause All',
                    click: this.pauseAll
                },
                {
                    label: 'Resume All',
                    click: this.resumeAll
                }
            ]
        },
        {
            label: 'Labels',
            click: this.setCategory,
            type: 'labels'
        }
    ]

    this.contextMenu = [
        {
            label: 'Recheck',
            click: this.recheck,
            icon: 'checkmark'
        },
        {
            label: 'Move Up Queue',
            click: this.queueUp,
            icon: 'arrow up'
        },
        {
            label: 'Move Queue Down',
            click: this.queueDown,
            icon: 'arrow down'
        },
        {
            label: 'Queue Top',
            click: this.queueTop,
            icon: 'chevron circle up'
        },
        {
            label: 'Queue Bottom',
            click: this.queueBottom,
            icon: 'chevron circle down'
        },
        {
            label: 'Remove',
            click: this.delete,
            icon: 'remove'
        },
        {
            label: 'Remove And Delete',
            click: this.deleteWithData,
            icon: 'trash'
        }
    ];

}]);
