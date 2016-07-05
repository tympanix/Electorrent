'use strict';

angular.module('torrentApp').service('configService', ['electron', '$q', function(electron, $q) {

    const config = electron.config;

    this.settings = function() {
        return config.settingsReference();
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
        return config.getAllSettings();
    }

    this.saveAllSettings = function(settings) {
        var q = $q.defer();
        config.saveAll(settings, function(err){
            if (err) q.reject(err)
            else q.resolve();
        });
        return q.promise;
    }

    this.saveServer = function(ip, port, user, password){
        if (arguments.length === 1){
            return put('server', arguments[0]);
        } else {
            return put('server', {
                ip: ip,
                port: port,
                user: user,
                password: password
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
