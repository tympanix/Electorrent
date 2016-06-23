'use strict';

angular.module('torrentApp')
    .service('utorrentService', function($http, $resource, $log, $q, Torrent) {

        var loading = null;
        var data = {
            url: 'http://192.168.0.33:8080/gui/',
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
                var torrent = new Torrent(
                    array[0],
                    array[1],
                    array[2],
                    array[3],
                    array[4],
                    array[5],
                    array[6],
                    array[7],
                    array[8],
                    array[9],
                    array[10],
                    array[11],
                    array[12],
                    array[13],
                    array[14],
                    array[15],
                    array[16],
                    array[17],
                    array[18],
                    array[19],
                    array[20],
                    array[21],
                    array[22],
                    array[23],
                    array[24],
                    array[25],
                    array[26],
                    additionalData
                );
                //torrent._base = array;
                return torrent;
            }
        };

        return torrentServerService;
    });
