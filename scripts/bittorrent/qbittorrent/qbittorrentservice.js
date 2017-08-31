'use strict';

angular.module('torrentApp').service('qbittorrentService', ["$http", "$resource", "$log", "$q", "TorrentQ",
    "notificationService", "httpFormService",
    function($http, $resource, $log, $q, Torrent, $notify, httpFormService) {

        this.name = 'qBittorrent';
        this.server = undefined;

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

        this.pause = function(torrents) {
            return this.doAction('pause', torrents);
        }

        this.start = function(torrents) {
            return this.doAction('resume', torrents);
        }

        this.delete = function(torrents) {
            return this.doMultiAction('delete', torrents);
        }

        this.deleteWithData = function(torrents) {
            return this.doMultiAction('deletePerm', torrents);
        }

        this.recheck = function(torrents) {
            return this.doAction('recheck', torrents);
        }

        this.queueUp = function(torrents) {
            return this.doMultiAction('increasePrio', torrents);
        }

        this.queueDown = function(torrents) {
            return this.doMultiAction('decreasePrio', torrents);
        }

        this.queueTop = function(torrents) {
            return this.doMultiAction('topPrio', torrents);
        }

        this.queueBottom = function(torrents) {
            return this.doMultiAction('bottomPrio', torrents);
        }

        this.sequentialDownload = function(torrents) {
            return this.doMultiAction('toggleSequentialDownload', torrents)
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
                label: 'Sequential Download',
                click: this.sequentialDownload,
                check: function(torrent) {
                    return torrent.sequentialDownload
                }
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