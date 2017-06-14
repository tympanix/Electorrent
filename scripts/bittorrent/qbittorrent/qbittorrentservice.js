'use strict';

angular.module('torrentApp').service('qbittorrentService', ["$http", "$resource", "$log", "$q", "TorrentQ",
    "notificationService", "httpFormService",
    function($http, $resource, $log, $q, Torrent, $notify, httpFormService) {

        this.name = 'qBittorrent';
        this.server = undefined;

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

        this.url = function(path) {
            return `${this.server.url()}${path}`;
        }

        this.connect = function(server) {
            this.server = server
            var defer = $q.defer();

            $http.post(this.url('/login'), {
                    username: server.user,
                    password: server.password
                }, httpform)
                .then(function(response) {
                    if(response.data === 'Ok.') {
                        defer.resolve(response);
                    } else {
                        defer.reject(response, 401)
                        defer.reject('Wrong username/password');
                    }
                })
                .catch(function(response) {
                    if(response.status === 403) {
                        defer.reject(response, 'qBittorrent says', response.data)
                    } else {
                        defer.reject(response);
                    }
                });

            return defer.promise;
        }

        this.torrents = function(all) {
            var defer = $q.defer();

            if(all === true) rid = 0;

            $http.get(this.url('/sync/maindata'), {
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

        this.doAction = function(command, torrents) {
            let self = this
            if(!Array.isArray(torrents)) {
                return $notify.alert('Error', 'Action was passed incorrect arguments')
            }

            var hashes = torrents.map(function(torrent) {
                return torrent.hash
            })

            var promises = [];
            hashes.forEach(function(hash) {
                var req = $http.post(`${self.url('/command')}/${command}`, {
                    hash: hash
                }, httpform);
                promises.push(req);
            });

            return $q.all(promises);
        }

        this.doMultiAction = function(command, torrents) {
            var hashes = torrents.map(function(torrent) {
                return torrent.hash
            })

            return $http.post(`${this.url('/command')}/${command}`, {
                hashes: hashes
            }, httpform);
        }

        this.doGlobalAction = function(command) {
            return $http.post(`${this.url('/command')}/${command}`);
        }

        this.pause = function(hashes) {
            return this.doAction('pause', hashes);
        }

        this.start = function(hashes) {
            return this.doAction('resume', hashes);
        }

        this.delete = function(hashes) {
            return this.doMultiAction('delete', hashes);
        }

        this.deleteWithData = function(hashes) {
            return this.doMultiAction('deletePerm', hashes);
        }

        this.recheck = function(hashes) {
            return this.doAction('recheck', hashes);
        }

        this.queueUp = function(hashes) {
            return this.doMultiAction('increasePrio', hashes);
        }

        this.queueDown = function(hashes) {
            return this.doMultiAction('decreasePrio', hashes);
        }

        this.queueTop = function(hashes) {
            return this.doMultiAction('topPrio', hashes);
        }

        this.queueBottom = function(hashes) {
            return this.doMultiAction('bottomPrio', hashes);
        }

        this.pauseAll = function() {
            return this.doGlobalAction('pauseAll')
        }

        this.resumeAll = function() {
            return this.doGlobalAction('resumeAll')
        }

        this.addTorrentUrl = function(magnet) {
            return $http.post(this.url('/command/download'), {
                urls: magnet
            }, httpform)
        }

        this.setCategory = function(torrents, category) {
            var hashes = torrents.map(function(torrent) {
                return torrent.hash
            })

            return $http.post(this.url('/command/setCategory'), {
                hashes: hashes,
                category: category
            }, httpform)
        }

        this.uploadTorrent = function(buffer, filename) {
            var blob = new Blob([buffer], {
                type: 'application/x-bittorrent'
            })
            var formData = new FormData();
            formData.append('torrents', blob, filename);

            return $http.post(this.url('/command/upload'), formData, {
                headers: {
                    'Content-Type': undefined
                },
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

        this.actionHeader = [{
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
                actions: [{
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

        this.contextMenu = [{
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

    }
]);