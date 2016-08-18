'use strict';

angular.module('torrentApp').service('qbittorrentService', ["$http", "$resource", "$log", "$q", "TorrentQ", "notificationService", "httpFormService", function($http, $resource, $log, $q, Torrent, $notify, httpFormService) {

    var rid = 0;

    this.connect = function(ip, port, user, pass) {

        var defer = $q.defer();

        $http({
            method: 'POST',
            withCredentials: true,
            url: 'http://127.0.0.1:8080/login',
            transformRequest: httpFormService,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data: {
                username: 'admin',
                password: 'adminadmin'
            }
        }).success(function(data){
            console.log("qB connect", data);
            if (data === 'Ok.'){
                defer.resolve('qBittorrent login successfull');
            } else {
                defer.reject('Wrong username/password');
            }
        }).catch(function(){
            defer.reject('Could not connect to qBittorrent');
        });

        return defer.promise;
    }

    this.torrents = function(){
        var defer = $q.defer();

        var torrents = {
            labels: [],
            all:[],
            changed: [],
            deleted: []
        };

        $http({
            method: 'GET',
            url: 'http://127.0.0.1:8080/sync/maindata',
            params: {
                rid: rid
            },
            withCredentials: true
        }).success(function(data){
            rid = data.rid;
            torrents.labels = data.categories;
            torrents.all = buildAll(data.torrents);
            torrents.deleted = data.torrents_removed || [];

            console.log("Sync", data);
        }).catch(function(err){
            console.error(err);
        })

        return defer.promise;
    }

    function buildAll(torrents) {
        if (!torrents) return [];

        var torrentArray = []

        torrents.keys().map(function(hash){
            torrentArray.push(new Torrent(hash, torrents[hash]));
        })

        return torrentArray;
    }

}]);