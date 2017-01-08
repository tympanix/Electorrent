'use strict';

angular.module('torrentApp').service('$bittorrent', ['$rootScope', '$injector', '$btclients', 'configService', 'notificationService', 'electron', function($rootScope, $injector, $btclients, config, $notify, electron){

    this.getClient = function(clientName) {
        if (clientName) {
            return fetchClientManual(clientName);
        } else {
            return fetchClientAuto();
        }
    }

    this.changeClient = function(clientName) {
        var service = this.getClient(clientName);
        this.setClient(service);
    }

    this.setClient = function(service) {
        $rootScope.$btclient = service;
        console.info("Changed client to:", service.name || "<service missing name>");
    }

    this.setServer = function(server) {
        $rootScope.$btclient = this.getClient(server.client)
        $rootScope.$server = server
        server.updateLastUsed()
        config.saveAllSettings()
        console.info("Changed server to:", $rootScope.$server)
        console.info("Changed client to:", $rootScope.$btclient)
    }

    this.getServer = function() {
        return $rootScope.$server
    }

    function fetchClientAuto() {
        var server = config.getDefaultServer();
        if (!server) return
        return fetchClientManual(server.client);
    }

    function fetchClientManual(name) {
        var client = $btclients[name];

        if (client){
            return $injector.get(client.service);
        } else {
            console.error('Bittorrent client "' + name + '" not available');
        }
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
