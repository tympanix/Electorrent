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
        console.log("Changed client to:", service.name || "<service missing name>");
    }

    function fetchClientAuto() {
        var client = config.getServer().type;
        return fetchClientManual(client);
    }

    function fetchClientManual(name) {
        var client = $btclients[name];

        if (client){
            var service = $injector.get(client.service);
            return service;
        } else {
            console.error('Bittorrent client "' + name + '" not available');
        }
    }

    this.uploadFromClipboard = function() {
        var magnet = electron.clipboard.readText();

        // TODO: Lav et array med startværdier
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
