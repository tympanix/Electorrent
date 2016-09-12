'use strict';

angular.module('torrentApp').service('configService', ['electron', '$q', function(electron, $q) {

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
        }
    };

    this.initSettings = function() {
        var org = config.settingsReference();
        angular.merge(settings, org)
    }

    // Angular wrapper for saving to config
    function put(key, value){
        var q = $q.defer();
        config.put(key, value, function(err){
            if (err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    // Angular wrapper for getting config
    function get(value){
        return config.get(value);
    }

    this.getAllSettings = function() {
        return settings;
    }

    this.saveAllSettings = function(newSettings) {
        var q = $q.defer();
        angular.merge(settings, newSettings)
        config.saveAll(settings, function(err){
            if (err) q.reject(err)
            else q.resolve();
        });
        console.log("Org settings", settings);
        return q.promise;
    }

    this.saveServer = function(ip, port, user, password, client){
        if (arguments.length === 1){
            return put('server', arguments[0]);
        } else {
            return put('server', {
                ip: ip,
                port: port,
                user: user,
                password: password,
                type: client
            })
        }
    }

    this.getServer = function() {
        return get('server');
    }

    this.getResizeMode = function() {
        return get('resizeMode');
    }

    this.setResizeMode = function(mode) {
        return put('resizeMode', mode);
    }

}]);
