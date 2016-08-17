'use strict';

angular.module('torrentApp').service('torrentMiddlewareService', ['$injector', 'configService', function($injector, config){
    var server = config.getServer();
    console.log("Server", config.getServer());

    switch(server.type) {
        case 'qbittorrent':
            return $injector.get('qbittorrentService')
        case 'utorrent':
            return $injector.get('utorrentService')
        default:
            return $injector.get('utorrentService')
    }
}]);