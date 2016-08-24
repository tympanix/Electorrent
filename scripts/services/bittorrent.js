'use strict';

angular.module('torrentApp').service('$bittorrent', ['$rootScope', '$injector', 'clients', 'configService', function($rootScope, $injector, $clients, config){
    console.log("Config", config.getServer());

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
        var client = $clients[name];

        if (client){
            var service = $injector.get(client.service);
            return service;
        } else {
            throw new Error('Bittorrent client "' + client + '" not available')
        }
    }
}]);