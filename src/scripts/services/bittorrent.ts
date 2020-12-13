'use strict';

angular.module('torrentApp').service('$bittorrent', ['$rootScope', '$injector', '$btclients', 'notificationService', 'electron', function($rootScope, $injector, $btclients, $notify, electron){

    this.getClient = function(name) {
        var client = $btclients[name];
        if (client){
            return $injector.get(client.service);
        } else {
            throw new Error('Bittorrent client "' + name + '" not available');
        }
    }

    this.changeClient = function(clientName) {
        var service = this.getClient(clientName);
        this.setClient(service);
    }

    this.setClient = function(service) {
        $rootScope.$btclient = service;
        console.info("Changed client to:", service.name || "<unknown>");
    }

    this.setServer = function(server) {
        $rootScope.$btclient = this.getClient(server.client)
        $rootScope.$server = server
        server.updateLastUsed()
    }

    this.getServer = function() {
        return $rootScope.$server
    }

    this.getServerCopy = function() {
        return angular.copy($rootScope.$server)
    }

    this.uploadFromClipboard = function() {
        var magnet = electron.clipboard.readText();

        var protocol = ['magnet', 'http'];

        var supported = protocol.some(function(protocol) {
            return magnet.startsWith(protocol);
        })

        if (!supported) {
            $notify.alert('Wait a minute?', 'Your clipboard doesn\'t contain a magnet link');
            return;
        }

        $rootScope.$btclient.addTorrentUrl(magnet);
    }
}]);
