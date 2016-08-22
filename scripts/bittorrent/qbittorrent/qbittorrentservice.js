'use strict';

angular.module('torrentApp').service('qbittorrentService', ["$http", "$resource", "$log", "$q", "TorrentQ", "notificationService", "httpFormService", function($http, $resource, $log, $q, Torrent, $notify, httpFormService) {

    const boundaryHyphens = 27;
    const hyphen = '-';
    const boundaryUniqueNumber = 6688794727912;
    const httpBoundary = hyphen.repeat(boundaryHyphens).concat(boundaryUniqueNumber);

    var rid = 0;

    const httpform = {
        withCredentials: true,
        transformRequest: httpFormService,
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
        .success(function(data) {
            if(data === 'Ok.') {
                saveConnection(ip, port);
                defer.resolve('qBittorrent login successfull');
            } else {
                defer.reject('Wrong username/password');
            }
        })
        .catch(function() {
            defer.reject('Could not connect to qBittorrent');
        });

        return defer.promise;
    }

    this.torrents = function() {
        var defer = $q.defer();

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

    function doAction(command, hashes) {
        if(!Array.isArray(hashes)) {
            return $notify.alert('Error', 'Action was passed incorrect arguments')
        }

        var promises = [];
        hashes.forEach(function(hash) {
            var req = $http.post(`${url('/command')}/${command}`, {hash: hash}, httpform);
            promises.push(req);
        });
        return $q.all(promises);
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
        return doAction('delete', hashes);
    }

    this.deleteWithData = function(hashes) {
        return doAction('deletePerm', hashes);
    }

    this.recheck = function(hashes) {
        return doAction('recheck', hashes);
    }

    this.queueUp = function(hashes) {
        return doAction('increasePrio', hashes);
    }

    this.queueDown = function(hashes) {
        return doAction('decreasePrio', hashes);
    }

    this.queueTop = function(hashes) {
        return doAction('topPrio', hashes);
    }

    this.queueBottom = function(hashes) {
        return doAction('bottomPrio', hashes);
    }

    this.pauseAll = function() {
        return doGlobalAction('pauseAll')
    }

    this.resumeAll = function() {
        return doGlobalAction('resumeAll')
    }

    this.addTorrentUrl = function(magnet) {
        var data = httpPostTorrentData(magnet);
        return $http.post(url('/command/download'), data, {
            withCredentials: true,
            headers: {
                'Content-Type': `multipart/form-data; boundary=${httpBoundary}`,
            }
        })
    }

    function httpPostTorrentData(magnet) {
        var r = [];
        r.push(httpBoundary);

        httpDataAddPart(r, 'urls', magnet);
        httpDataAddPart(r, 'savepath', '');
        httpDataAddPart(r, 'cookie', '');
        httpDataAddPart(r, 'lbale', '');

        return r.join('\n');
    }

    function httpDataAddPart(r, part, data) {
        r.push(`Content-Disposition: form-data; name="${part}"`)
        r.push(encodeURI(data))
        r.push(httpBoundary)
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

    this.actions = {
        'start': this.start,
        'pause': this.pause,
        'remove': this.delete,
        'removedata': this.deleteWithData,
        'recheck': this.recheck,
        'queueup': this.queueUp,
        'queuedown': this.queueDown,
        'forcestart': undefined
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