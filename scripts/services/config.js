'use strict';

angular.module('torrentApp').service('configService', ['electron', '$q', 'Server', function(electron, $q, Server) {

    const config = electron.config;

    var settings = {
        server: {
            ip: '',
            port: '',
            user: '',
            password: '',
            type: '',
        },
        ui: {
            resizeMode: '',
            notifications: true
        },
        servers: []
    };

    this.initSettings = function() {
        var org = config.settingsReference();
        angular.merge(settings, org)
    }

    // Angular wrapper for saving to config
    function put(key, value) {
        var q = $q.defer();
        config.put(key, value, function(err) {
            if(err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    // Angular wrapper for getting config
    function get(value) {
        return config.get(value);
    }

    function isDefault(server) {
        return server.default === true
    }

    function appendServer(server) {
        settings.servers.push(server.json())
    }

    this.getAllSettings = function() {
        return settings;
    }

    this.setDefault = function(server) {
        let found = this.getServer(server.id)
        if (!found) return
        settings.servers.forEach(function(value) {
            value.default = false
        })
        found.default = true
        return this.saveAllSettings()
    }

    this.saveAllSettings = function(newSettings) {
        var q = $q.defer();
        angular.merge(settings, newSettings)
        config.saveAll(settings, function(err) {
            if(err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    this.saveServer = function(ip, port, user, password, client) {
        if(arguments.length === 1) {
            appendServer(arguments[0]);
        } else {
            appendServer(new Server(ip, port, user, password, client))
        }
        console.info("Servers:", settings.servers);
        return this.saveAllSettings()
    }

    this.updateServer = function(update) {
        let server = this.getServer(update.id);
        if(!server) return $q.reject('Server with id ' + update.id + ' not found')
        angular.merge(server, update)
        console.info("Servers:", settings.servers);
        return this.saveAllSettings()
    }

    this.getServer = function(id) {
        return settings.servers.find((server) => server.id === id)
    }

    this.getDefaultServer = function() {
        return settings.servers.find(isDefault)
    }

}]);